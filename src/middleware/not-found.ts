// Middleware for handling 404 errors
import { Request, Response, NextFunction } from 'express';

const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
    res.status(404).json({
        status: 'error',
        message: 'Not Found',
    });
};

export default notFoundHandler;