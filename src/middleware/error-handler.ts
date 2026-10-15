import { Request, Response, NextFunction } from 'express';

const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    const statusCode = err.statusCode || err.status || 500;
    const message = err.type === 'entity.parse.failed'
        ? 'Malformed JSON'
        : err.type === 'entity.too.large'
            ? 'Payload Too Large'
            : statusCode === 500 ? 'Internal Server Error' : err.message;
    const response = {
        status: 'error',
        message,
    };

    res.status(statusCode).json(response);
};

export default errorHandler;