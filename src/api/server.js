const express = require('express');
const cors = require('cors');

class ApiServer {
    constructor(port = 3000) {
        this.port = port;
        this.app = express();
        this.server = null;
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // CORS - allow requests from your admin dashboard
        this.app.use(cors({
            origin: [
                'http://localhost:4000',
                'http://localhost:4001',
                'https://backend.kodex.academy',
                'https://kodex.academy'
            ],
            credentials: true
        }));

        // Body parsing
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        // Request logging
        this.app.use((req, res, next) => {
            console.log(`📡 API: ${req.method} ${req.path}`);
            next();
        });
    }

    setupRoutes() {
        const apiRoutes = require('./routes');
        
        // Mount API routes
        this.app.use('/api', apiRoutes);

        // Root endpoint
        this.app.get('/', (req, res) => {
            res.json({
                name: 'Kodex Tweet Bot API',
                version: '1.0.0',
                endpoints: {
                    status: 'GET /api/status',
                    latestPosts: 'GET /api/latest-posts',
                    generateNews: 'POST /api/generate-news',
                    generateWisdom: 'POST /api/generate-wisdom',
                    generateDiary: 'POST /api/generate-diary',
                    health: 'GET /api/health'
                }
            });
        });

        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({
                success: false,
                message: 'Endpoint not found'
            });
        });

        // Error handler
        this.app.use((err, req, res, next) => {
            console.error('API Error:', err);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: err.message
            });
        });
    }

    start() {
        return new Promise((resolve, reject) => {
            try {
                this.server = this.app.listen(this.port, () => {
                    console.log(`✅ Tweet Bot API server running on port ${this.port}`);
                    console.log(`📡 API endpoints available at http://localhost:${this.port}/api`);
                    resolve();
                });

                this.server.on('error', (error) => {
                    if (error.code === 'EADDRINUSE') {
                        console.log(`⚠️ Port ${this.port} is already in use, API server not started`);
                        console.log(`   This is normal if another instance is running`);
                        resolve(); // Don't reject, just resolve without starting
                    } else {
                        reject(error);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    console.log('🛑 API server stopped');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = ApiServer;

