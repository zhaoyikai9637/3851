import multer from "multer";

export function notFound(req, res) {
  res.status(404).json({ message: "API route not found." });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE"
      ? "Resume files must be 5 MB or smaller."
      : "The resume upload could not be processed.";
    return res.status(400).json({ message });
  }

  const status = error.status || 500;
  if (status >= 500 && process.env.NODE_ENV !== "test") {
    console.error(error);
  }
  return res.status(status).json({
    message: status >= 500 ? "The server could not complete this request." : error.message,
  });
}
