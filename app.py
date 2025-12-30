"""
Bureaucracy Breaker - Complete Backend with Website Form Support
Transforms PDF and website forms into conversational experiences.
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.utils import secure_filename
import PyPDF2
import io
import os
import json
import requests
import re
import base64
import time
from PIL import Image
from dotenv import load_dotenv
from datetime import datetime
import uuid
from typing import Dict, List, Optional, Any

# Initialize Flask app
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["chrome-extension://*", "http://localhost:3000", "http://localhost:8004"]}})

# Load environment variables
load_dotenv()
OPENROUTER_API_KEY = os.getenv("My_api_key")

# Configuration
UPLOAD_FOLDER = 'temp_uploads'
ALLOWED_EXTENSIONS = {'pdf'}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# ============================================================================
# SESSION MANAGEMENT
# ============================================================================

class Session:
    def __init__(self, session_id):
        self.session_id = session_id
        self.form_fields = []
        self.current_field_index = 0
        self.answers = {}
        self.created_at = datetime.now()
        self.original_pdf = None
        self.is_fillable_pdf = True
        self.pdf_text_content = ""
        self.pre_generated_questions = {}
        self.questions_generated = False
        self.uploaded_images = {}
        self.document_summary = ""
        self.answered_checkbox_groups = set()
        self.form_type = "pdf"  # 'pdf' or 'website'
        self.form_html = ""

sessions = {}

def create_session():
    """Create a new session with unique ID."""
    session_id = str(uuid.uuid4())
    sessions[session_id] = Session(session_id)
    print(f"[INFO] Created new session: {session_id}")
    return sessions[session_id]

def get_session(session_id):
    """Get session by ID or return error."""
    if session_id not in sessions:
        return None
    return sessions[session_id]

# ============================================================================
# PDF PROCESSING
# ============================================================================

class PDFProcessor:
    """Handles PDF form processing."""

    @staticmethod
    def extract_fields(pdf_bytes: bytes) -> List[Dict]:
        """Extract field information from a PDF's AcroForm."""
        try:
            pdf_stream = io.BytesIO(pdf_bytes)
            pdf_reader = PyPDF2.PdfReader(pdf_stream)
            print(f"[DEBUG] PDF has {len(pdf_reader.pages)} pages")
            field_list = []

            # Try to get fields from the PDF reader
            try:
                if hasattr(pdf_reader, 'get_fields'):
                    fields_dict = pdf_reader.get_fields()
                    if fields_dict:
                        for field_name, field_obj in fields_dict.items():
                            field_type = PDFProcessor._determine_field_type(field_obj)
                            field_info = {
                                "name": str(field_name),
                                "type": field_type
                            }
                            field_list.append(field_info)
                            print(f"[DEBUG] Found field: {field_name} ({field_type})")
            except Exception as e:
                print(f"[DEBUG] get_fields() failed: {e}")

            if field_list:
                print(f"[INFO] Found {len(field_list)} AcroForm fields")
                return field_list

            print("[INFO] No AcroForm fields found in PDF")
            return []

        except Exception as e:
            print(f"[ERROR] Field extraction failed: {str(e)}")
            return []

    @staticmethod
    def _determine_field_type(field_obj) -> str:
        """Determine field type based on PDF field object."""
        try:
            ft_value = None
            if hasattr(field_obj, 'get'):
                ft_value = field_obj.get('/FT')
            elif isinstance(field_obj, dict):
                ft_value = field_obj.get('/FT')

            if ft_value:
                ft_str = str(ft_value)
                if '/Tx' in ft_str:
                    return "text"
                elif '/Btn' in ft_str:
                    return "checkbox"
                elif '/Ch' in ft_str:
                    return "choice"

            return "text"
        except Exception as e:
            print(f"[DEBUG] Field type detection error: {e}")
            return "text"

    @staticmethod
    def extract_text(pdf_bytes: bytes) -> str:
        """Extract all text content from a PDF."""
        try:
            pdf_stream = io.BytesIO(pdf_bytes)
            pdf_reader = PyPDF2.PdfReader(pdf_stream)
            text_content = []

            for page_num, page in enumerate(pdf_reader.pages):
                try:
                    page_text = page.extract_text()
                    if page_text:
                        text_content.append(f"--- Page {page_num + 1} ---\n{page_text}")
                except Exception as e:
                    print(f"[DEBUG] Error extracting text from page {page_num}: {e}")
                    continue

            full_text = "\n\n".join(text_content)
            print(f"[INFO] Extracted {len(full_text)} characters of text from PDF")
            return full_text

        except Exception as e:
            print(f"[ERROR] Text extraction failed: {e}")
            return ""

    @staticmethod
    def fill_pdf(pdf_bytes: bytes, answers: Dict[str, str]) -> bytes:
        """Fill PDF form fields with provided answers."""
        try:
            input_stream = io.BytesIO(pdf_bytes)
            output_stream = io.BytesIO()

            pdf_reader = PyPDF2.PdfReader(input_stream)
            pdf_writer = PyPDF2.PdfWriter()

            # Copy all pages to writer
            for page in pdf_reader.pages:
                pdf_writer.add_page(page)

            # Update form fields if they exist
            if hasattr(pdf_writer, 'update_page_form_field_values'):
                for page_num in range(len(pdf_writer.pages)):
                    try:
                        pdf_writer.update_page_form_field_values(
                            pdf_writer.pages[page_num],
                            answers
                        )
                    except Exception:
                        continue

            # Write the updated PDF to output stream
            pdf_writer.write(output_stream)
            output_stream.seek(0)
            return output_stream.read()

        except Exception:
            return pdf_bytes

# ============================================================================
# WEBSITE FORM PROCESSING
# ============================================================================

class WebFormProcessor:
    """Handles website form processing."""

    @staticmethod
    def extract_fields_from_html(html: str, forms_data: List[Dict] = None) -> List[Dict]:
        """Extract field information from HTML."""
        fields = []
        
        # If we have structured form data from content script, use that
        if forms_data:
            for form in forms_data:
                for field in form.get('fields', []):
                    if field['name'] not in [f['name'] for f in fields]:
                        fields.append({
                            'name': field['name'],
                            'type': field.get('type', 'text'),
                            'label': field.get('label', field['name'])
                        })
        else:
            # Fallback: parse HTML directly
            # Text inputs
            text_pattern = r'<input[^>]*name=["\']([^"\']+)["\'][^>]*?(?:type=["\'](?:text|email|tel|number|date)["\'])?[^>]*>'
            for match in re.finditer(text_pattern, html, re.IGNORECASE):
                name = match.group(1)
                if name not in [f['name'] for f in fields]:
                    label = WebFormProcessor._extract_label(html, name)
                    fields.append({
                        'name': name,
                        'type': 'text',
                        'label': label or name.replace('_', ' ').replace('-', ' ').title()
                    })
            
            # Textareas
            textarea_pattern = r'<textarea[^>]*name=["\']([^"\']+)["\']'
            for match in re.finditer(textarea_pattern, html, re.IGNORECASE):
                name = match.group(1)
                if name not in [f['name'] for f in fields]:
                    label = WebFormProcessor._extract_label(html, name)
                    fields.append({
                        'name': name,
                        'type': 'textarea',
                        'label': label or name.replace('_', ' ').replace('-', ' ').title()
                    })
            
            # Selects
            select_pattern = r'<select[^>]*name=["\']([^"\']+)["\']'
            for match in re.finditer(select_pattern, html, re.IGNORECASE):
                name = match.group(1)
                if name not in [f['name'] for f in fields]:
                    label = WebFormProcessor._extract_label(html, name)
                    fields.append({
                        'name': name,
                        'type': 'select',
                        'label': label or name.replace('_', ' ').replace('-', ' ').title()
                    })

        print(f"[INFO] Extracted {len(fields)} fields from website form")
        return fields

    @staticmethod
    def _extract_label(html: str, field_name: str) -> Optional[str]:
        """Try to extract label for a field."""
        # Look for label with for attribute
        label_pattern = rf'<label[^>]*for=["\'](?:[^"\']*{field_name}[^"\']*)["\'][^>]*>(.*?)</label>'
        match = re.search(label_pattern, html, re.IGNORECASE | re.DOTALL)
        if match:
            label_text = re.sub(r'<[^>]+>', '', match.group(1)).strip()
            return label_text
        
        # Look for nearby text
        field_pattern = rf'(?:<label[^>]*>|<span[^>]*>|<div[^>]*>)([^<]*)</(?:label|span|div)>[^<]*<input[^>]*name=["\']{field_name}["\']'
        match = re.search(field_pattern, html, re.IGNORECASE)
        if match:
            return match.group(1).strip()
        
        return None

# ============================================================================
# AI CONVERTERS
# ============================================================================

class AIConverter:
    """Handles AI-based question generation using OpenRouter."""

    OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
    DEFAULT_MODEL = "mistralai/mistral-7b-instruct"

    SYSTEM_PROMPT = """You are a professional form assistant helping users fill out forms.
Your ONLY job is to convert form field names into clear, professional questions.

CRITICAL RULES:
1. ONLY ask about the EXACT field provided
2. Match question type to field type
3. Be professional and helpful
4. Keep questions concise and clear
5. NEVER ask the same question twice

OUTPUT FORMAT:
Question: [Your question here]
Help: [One sentence explaining what to enter]"""

    @staticmethod
    def generate_question(field: Dict, context: str = "") -> Optional[Dict]:
        """Generate a conversational question for a form field using AI."""
        field_name = field.get('name', '')
        field_type = field.get('type', 'text')
        field_label = field.get('label', '')
        
        print(f"[DEBUG] Generating question for field: {field_name} ({field_type})")

        if not OPENROUTER_API_KEY:
            print("[WARNING] No OpenRouter API key - using fallback")
            return AIConverter._fallback_question(field_name, field_type, field_label)

        try:
            # Build prompt
            prompt = f"""Convert this form field into a natural question:

Field Name: {field_name}
Field Type: {field_type}
Label: {field_label}

Context: {context[:500] if context else 'General form field'}

Generate a clear question and helpful explanation."""

            payload = {
                "model": AIConverter.DEFAULT_MODEL,
                "messages": [
                    {"role": "system", "content": AIConverter.SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.7,
                "max_tokens": 150
            }

            headers = {
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json"
            }

            response = requests.post(
                AIConverter.OPENROUTER_URL,
                json=payload,
                headers=headers,
                timeout=15
            )

            if response.status_code == 200:
                result = response.json()
                content = result['choices'][0]['message']['content']
                return AIConverter._parse_response(content, field_name)
            else:
                print(f"[WARNING] AI API returned {response.status_code}")
                return AIConverter._fallback_question(field_name, field_type, field_label)

        except Exception as e:
            print(f"[ERROR] AI generation failed: {e}")
            return AIConverter._fallback_question(field_name, field_type, field_label)

    @staticmethod
    def _parse_response(content: str, field_name: str) -> Dict:
        """Parse AI response into structured format."""
        question = ""
        explanation = ""

        lines = content.strip().split('\n')
        for line in lines:
            if line.startswith('Question:'):
                question = line.replace('Question:', '').strip()
            elif line.startswith('Help:'):
                explanation = line.replace('Help:', '').strip()

        if not question:
            question = f"What should we enter for {field_name}?"
        if not explanation:
            explanation = "Please provide the requested information."

        return {
            "question": question,
            "explanation": explanation,
            "field_name": field_name
        }

    @staticmethod
    def _fallback_question(field_name: str, field_type: str, field_label: str) -> Dict:
        """Generate a simple fallback question."""
        label = field_label if field_label else field_name.replace('_', ' ').replace('-', ' ').title()
        
        if field_type == 'email':
            question = f"What is your {label.lower()}?"
            explanation = "Please enter a valid email address."
        elif field_type == 'tel':
            question = f"What is your {label.lower()}?"
            explanation = "Please enter your phone number."
        elif field_type == 'date':
            question = f"What is the {label.lower()}?"
            explanation = "Please enter the date (e.g., MM/DD/YYYY)."
        elif field_type == 'select':
            question = f"Please select {label.lower()}"
            explanation = "Choose from the available options."
        else:
            question = f"What is your {label.lower()}?"
            explanation = "Please provide the requested information."

        return {
            "question": question,
            "explanation": explanation,
            "field_name": field_name
        }

# ============================================================================
# ROUTES - HEALTH & INFO
# ============================================================================

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "version": "1.0.0",
        "features": ["pdf_forms", "website_forms", "ai_questions"],
        "openrouter_configured": bool(OPENROUTER_API_KEY)
    })

# ============================================================================
# ROUTES - PDF FORMS
# ============================================================================

@app.route('/upload-pdf', methods=['POST'])
def upload_pdf():
    """Upload and process a PDF form."""
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    if not file.filename.endswith('.pdf'):
        return jsonify({"error": "File must be a PDF"}), 400

    try:
        pdf_bytes = file.read()
        
        if len(pdf_bytes) > MAX_FILE_SIZE:
            return jsonify({"error": "File too large. Maximum 50MB."}), 400

        # Extract fields
        fields = PDFProcessor.extract_fields(pdf_bytes)
        
        if not fields:
            return jsonify({"error": "No fillable fields found in PDF"}), 400

        # Extract text for context
        pdf_text = PDFProcessor.extract_text(pdf_bytes)

        # Create session
        session = create_session()
        session.form_fields = fields
        session.original_pdf = pdf_bytes
        session.pdf_text_content = pdf_text
        session.form_type = "pdf"

        return jsonify({
            "session_id": session.session_id,
            "total_fields": len(fields),
            "message": "PDF uploaded successfully"
        })

    except Exception as e:
        print(f"[ERROR] PDF upload failed: {str(e)}")
        return jsonify({"error": f"Upload failed: {str(e)}"}), 500

@app.route('/start-session', methods=['POST'])
def start_session():
    """Start a form filling session."""
    data = request.get_json() or {}
    session_id = data.get('session_id')

    session = get_session(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404

    session.current_field_index = 0

    # Get first field
    if session.form_fields:
        field = session.form_fields[0]
        field_name = field.get('name', '')

        # Generate question
        try:
            context = session.pdf_text_content if session.form_type == "pdf" else session.form_html
            question_data = AIConverter.generate_question(field, context)
        except Exception as e:
            print(f"[ERROR] Question generation failed: {e}")
            question_data = {"question": f"Please provide {field_name}:", "explanation": "Enter the required information."}

        return jsonify({
            "session_id": session.session_id,
            "question": {
                "text": question_data.get("question"),
                "explanation": question_data.get("explanation"),
                "field_name": field_name,
                "current": 1,
                "total": len(session.form_fields)
            }
        })

    return jsonify({"error": "No fields to process"}), 400

@app.route('/next-question', methods=['POST'])
def next_question():
    """Get next question in sequence."""
    data = request.get_json() or {}
    session_id = data.get('session_id')
    answer = data.get('answer')

    session = get_session(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404

    # Store answer if provided
    if answer is not None and session.current_field_index < len(session.form_fields):
        current_field = session.form_fields[session.current_field_index]
        field_name = current_field.get('name')
        if field_name:
            session.answers[field_name] = answer

    # Move to next field
    session.current_field_index += 1

    # Check if we're done
    if session.current_field_index >= len(session.form_fields):
        return jsonify({"completed": True})

    # Get next field
    field = session.form_fields[session.current_field_index]
    field_name = field.get('name', '')

    # Generate question
    try:
        context = session.pdf_text_content if session.form_type == "pdf" else session.form_html
        question_data = AIConverter.generate_question(field, context)
    except Exception as e:
        print(f"[ERROR] Question generation failed: {e}")
        question_data = {"question": f"Please provide {field_name}:", "explanation": "Enter the required information."}

    return jsonify({
        "session_id": session.session_id,
        "question": {
            "text": question_data.get("question"),
            "explanation": question_data.get("explanation"),
            "field_name": field_name,
            "current": session.current_field_index + 1,
            "total": len(session.form_fields)
        }
    })

@app.route('/generate-pdf', methods=['POST'])
def generate_pdf():
    """Generate a completed PDF."""
    data = request.get_json() or {}
    session_id = data.get('session_id')

    session = get_session(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404

    if session.form_type != "pdf":
        return jsonify({"error": "This is not a PDF form session"}), 400

    if not session.answers:
        return jsonify({"error": "No answers provided"}), 400

    if not session.original_pdf:
        return jsonify({"error": "Original PDF not found"}), 400

    try:
        filled_pdf_bytes = PDFProcessor.fill_pdf(session.original_pdf, session.answers)

        # Clean up session
        if session_id in sessions:
            del sessions[session_id]

        return app.response_class(
            response=filled_pdf_bytes,
            status=200,
            mimetype="application/pdf",
            headers={"Content-Disposition": "attachment;filename=completed_form.pdf"}
        )

    except Exception as e:
        print(f"[ERROR] PDF generation failed: {str(e)}")
        return jsonify({"error": f"Unable to generate PDF: {str(e)}"}), 400

# ============================================================================
# ROUTES - WEBSITE FORMS
# ============================================================================

@app.route('/analyze-website-form', methods=['POST'])
def analyze_website_form():
    """Analyze website form fields and create a session."""
    try:
        data = request.get_json() or {}
        form_html = data.get('form_html', '')
        forms_data = data.get('forms_data', None)

        if not form_html:
            return jsonify({"error": "No form HTML provided"}), 400

        # Extract fields
        fields = WebFormProcessor.extract_fields_from_html(form_html, forms_data)

        if not fields:
            return jsonify({"error": "No form fields detected"}), 400

        # Create session
        session = create_session()
        session.form_fields = fields
        session.form_html = form_html
        session.form_type = "website"

        return jsonify({
            "session_id": session.session_id,
            "form_type": "website",
            "total_fields": len(fields),
            "fields": [{'name': f['name'], 'label': f['label'], 'type': f['type']} for f in fields]
        })

    except Exception as e:
        print(f"[ERROR] Website form analysis failed: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/fill-website-form', methods=['POST'])
def fill_website_form():
    """Get filled website form data."""
    try:
        data = request.get_json() or {}
        session_id = data.get('session_id')

        session = get_session(session_id)
        if not session:
            return jsonify({"error": "Session not found"}), 404

        if session.form_type != "website":
            return jsonify({"error": "This is not a website form session"}), 400

        return jsonify({
            "success": True,
            "field_values": session.answers,
            "message": f"Successfully processed {len(session.answers)} fields"
        })

    except Exception as e:
        print(f"[ERROR] Website form filling failed: {e}")
        return jsonify({"error": str(e)}), 500

# ============================================================================
# ROUTES - IMAGE UPLOAD
# ============================================================================

@app.route('/upload-image', methods=['POST'])
def upload_image():
    """Handle image upload for signature fields."""
    session_id = request.args.get('session_id')
    field_name = request.args.get('field_name', 'signature')

    session = get_session(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404

    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    try:
        image_bytes = file.read()
        session.uploaded_images[field_name] = image_bytes
        session.answers[field_name] = f"[IMAGE_UPLOADED: {file.filename}]"

        return jsonify({
            "success": True,
            "message": "Image uploaded successfully"
        })

    except Exception as e:
        print(f"[ERROR] Image upload failed: {e}")
        return jsonify({"error": str(e)}), 500

# ============================================================================
# ERROR HANDLERS
# ============================================================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500

# ============================================================================
# MAIN
# ============================================================================

if __name__ == '__main__':
    print("=" * 60)
    print("🚀 Bureaucracy Breaker Backend Starting")
    print("=" * 60)
    print(f"🌐 Server: http://localhost:8004")
    print(f"🔑 OpenRouter API Key: {'✅ Configured' if OPENROUTER_API_KEY else '❌ Missing'}")
    print(f"📁 Upload Folder: {UPLOAD_FOLDER}")
    print(f"✨ Features: PDF Forms + Website Forms")
    print("=" * 60)
    
    app.run(host='localhost', port=8004, debug=True)
