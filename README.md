# My E-Commerce App

A full-stack e-commerce web application built with Node.js, TypeScript, Express, MongoDB, and a modern frontend.

## Live Demo

Visit: [https://vatsal.justanotherdevel.com/](https://vatsal.justanotherdevel.com/)  
Hosted on AWS EC2.

## Features

- User authentication and registration
- Product browsing, categories, and search
- Shopping cart and secure checkout (Stripe integration)
- Admin dashboard for managing products, orders, and users
- Real-time chat support (Socket.IO)
- Responsive design with Tailwind CSS

## Project Structure

```
├── src/                # Backend (Express, TypeScript)
├── frontend/           # Frontend (HTML, CSS, JS/TS)
├── package.json
├── tsconfig.json
├── DockerFile
├── .env
└── .dockerignore
```

## Getting Started

### Prerequisites

- Node.js 20.x
- npm
- MongoDB
- Docker (optional)
- AWS credentials (for S3 uploads)

### Local Development

1. **Install dependencies:**
    ```sh
    npm install
    ```

2. **Configure environment variables:**
    - Copy `.env.example` to `.env` and fill in your values.

3. **Build the project:**
    ```sh
    npm run build:backend
    npm run build:frontend
    ```

4. **Start the server:**
    ```sh
    npm start
    ```

5. **Access the app:**
    - Open [http://localhost:5001](http://localhost:5001)

### Docker Usage

Your `DockerFile` uses multi-stage builds for efficient production images.

1. **Build the Docker image:**
    ```sh
    docker build -t my-ecommerce-app .
    ```

2. **Run the container:**
    ```sh
    docker run -p 5001:5001 --env-file .env my-ecommerce-app
    ```

## Deployment

- The app is deployed on an AWS EC2 instance.
- For production, ensure your `.env` file contains correct credentials and URLs.

## License

MIT

---

**Note:**  
- Update `.env` with your credentials and keys.
- For Stripe payments, use test keys in development.
- For AWS S3, configure credentials in
