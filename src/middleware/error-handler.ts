import { Request, Response, NextFunction } from 'express';

const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    const statusCode = err.statusCode || 500;
    const response = {
        status: 'error',
        message: statusCode === 500 ? 'Internal Server Error' : err.message,
    };

    res.status(statusCode).json(response);
};

export default errorHandler;