import logging
import os
import sys

def setup_logging() -> logging.Logger:
    """Configures centralized structured logging for the Quickgent Engine."""
    log_level = os.environ.get("LOG_LEVEL", "INFO").upper()

    log_format = (
        "%(asctime)s | %(levelname)-7s | [%(name)s] %(message)s"
    )
    date_format = "%Y-%m-%d %H:%M:%S"

    logging.basicConfig(
        level=log_level,
        format=log_format,
        datefmt=date_format,
        handlers=[
            logging.StreamHandler(sys.stdout)
        ],
        force=True,
    )

    # Set specific third-party logger levels to reduce noise
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)

    logger = logging.getLogger("engine")
    logger.info(f"Logging initialized at level {log_level}")
    return logger
