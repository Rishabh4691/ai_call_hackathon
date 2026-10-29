"""Error codes and exception handlers (spec section 7).

Every error returns {"error": "<code>", "message": "<short English text>"}.
The frontend maps each code to a friendly DE/EN message.
"""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

log = logging.getLogger("navigator")

STATUS = {
    "empty_audio": 400,
    "no_speech": 422,
    "bad_request": 400,
    "server_busy": 503,
    "internal": 500,
}

DEFAULT_MESSAGES = {
    "empty_audio": "No audio received, or the recording is too short.",
    "no_speech": "No speech was detected in the recording.",
    "bad_request": "The request is invalid.",
    "server_busy": "The server is busy. Please try again in a moment.",
    "internal": "Something went wrong on the server.",
}


class APIError(Exception):
    def __init__(self, code: str, message: str | None = None):
        if code not in STATUS:
            code = "internal"
        self.code = code
        self.message = message or DEFAULT_MESSAGES[code]
        super().__init__(f"{code}: {self.message}")


def error_response(code: str, message: str | None = None) -> JSONResponse:
    err = APIError(code, message)
    return JSONResponse(status_code=STATUS[err.code], content={"error": err.code, "message": err.message})


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(APIError)
    async def _api_error(_: Request, exc: APIError):
        return error_response(exc.code, exc.message)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError):
        return error_response("bad_request", "Invalid form fields.")

    @app.exception_handler(Exception)
    async def _unexpected(_: Request, exc: Exception):
        # Log the full traceback, never send it to the client.
        log.exception("Unhandled error")
        return error_response("internal")
