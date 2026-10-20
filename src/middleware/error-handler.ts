import { Request, Response, NextFunction } from 'express';

const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    const isUploadError = err.name === 'MulterError';
    const statusCode = err.code === 'LIMIT_FILE_SIZE'
        ? 413
        : isUploadError ? 400 : err.statusCode || err.status || 500;
    const message = err.type === 'entity.parse.failed'
        ? 'Malformed JSON'
        : err.type === 'entity.too.large'
            ? 'Payload Too Large'
            : isUploadError
                ? statusCode === 413 ? 'Uploaded file is too large.' : 'Invalid multipart upload.'
                : statusCode >= 500 ? 'Internal Server Error' : err.message;
    const response = {
        status: 'error',
        message,
    };

    res.status(statusCode).json(response);
};

export default errorHandler;