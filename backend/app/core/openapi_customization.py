"""Custom OpenAPI/API docs configuration for dark mode."""

from fastapi.openapi.docs import get_swagger_ui_html


def get_swagger_ui_html_dark(*args, **kwargs):
    """Custom Swagger UI with dark mode CSS override."""
    html = get_swagger_ui_html(*args, **kwargs)
    
    # Inject dark mode CSS
    dark_mode_css = """
    <style>
        body {
            background-color: #09090b !important;
            color: #ffffff !important;
        }
        .swagger-ui .topbar {
            background-color: #18181b !important;
            border-bottom: 1px solid #27272a !important;
        }
        .swagger-ui .topbar .download-url-wrapper {
            background-color: #18181b !important;
        }
        .swagger-ui .topbar .download-url-wrapper input {
            background-color: #27272a !important;
            color: #ffffff !important;
            border: 1px solid #3f3f46 !important;
        }
        .swagger-ui .info {
            background-color: #18181b !important;
            color: #ffffff !important;
        }
        .swagger-ui .info .title {
            color: #ffffff !important;
        }
        .swagger-ui .scheme-container {
            background-color: #18181b !important;
        }
        .swagger-ui .opblock {
            background-color: #18181b !important;
            border: 1px solid #27272a !important;
        }
        .swagger-ui .opblock.opblock-get {
            border-color: #3b82f6 !important;
        }
        .swagger-ui .opblock.opblock-post {
            border-color: #22c55e !important;
        }
        .swagger-ui .opblock.opblock-put {
            border-color: #eab308 !important;
        }
        .swagger-ui .opblock.opblock-delete {
            border-color: #ef4444 !important;
        }
        .swagger-ui .opblock-tag {
            color: #ffffff !important;
            border-color: #27272a !important;
        }
        .swagger-ui .opblock-tag.no-desc span {
            color: #ffffff !important;
        }
        .swagger-ui .opblock-summary {
            background-color: #27272a !important;
            color: #ffffff !important;
        }
        .swagger-ui .opblock-description-wrapper,
        .swagger-ui .opblock-external-docs-wrapper {
            background-color: #18181b !important;
            color: #a1a1aa !important;
        }
        .swagger-ui .opblock-body {
            background-color: #09090b !important;
        }
        .swagger-ui .opblock-body pre {
            background-color: #18181b !important;
            color: #ffffff !important;
            border: 1px solid #27272a !important;
        }
        .swagger-ui .btn {
            background-color: #3b82f6 !important;
            color: #ffffff !important;
            border: none !important;
        }
        .swagger-ui .btn:hover {
            background-color: #2563eb !important;
        }
        .swagger-ui .btn.cancel {
            background-color: #27272a !important;
            color: #ffffff !important;
        }
        .swagger-ui .parameter__name {
            color: #ffffff !important;
        }
        .swagger-ui .parameter__type {
            color: #a1a1aa !important;
        }
        .swagger-ui .response-col_status {
            color: #ffffff !important;
        }
        .swagger-ui .response-col_description {
            color: #a1a1aa !important;
        }
        .swagger-ui input[type=text],
        .swagger-ui input[type=password],
        .swagger-ui input[type=search],
        .swagger-ui textarea {
            background-color: #27272a !important;
            color: #ffffff !important;
            border: 1px solid #3f3f46 !important;
        }
        .swagger-ui select {
            background-color: #27272a !important;
            color: #ffffff !important;
            border: 1px solid #3f3f46 !important;
        }
        .swagger-ui .model-box {
            background-color: #18181b !important;
            color: #ffffff !important;
            border: 1px solid #27272a !important;
        }
        .swagger-ui .model-title {
            color: #ffffff !important;
        }
        .swagger-ui .prop-type {
            color: #3b82f6 !important;
        }
        .swagger-ui .response-col_links {
            color: #a1a1aa !important;
        }
    </style>
    """
    
    # Insert dark mode CSS before closing head tag
    html.body = html.body.replace('</head>', dark_mode_css + '</head>')
    
    return html

