# My E-Commerce App

A full-stack e-commerce web application built with Node.js, TypeScript, Express, MongoDB, and a modern frontend using HTML, CSS (Tailwind), and TypeScript.

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
│   ├── app.ts
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   └── types/
├── frontend/           # Frontend (HTML, CSS, JS/TS)
│   ├── index.html
│   ├── cart.html
│   ├── checkout.html
│   ├── category.html
│   ├── login.html
│   ├── register.html
│   ├── admin/
│   ├── css/
│   ├── js/
│   └── ts/
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
- Docker (optional, for containerization)

### Local Development

1. **Install dependencies:**
    ```sh
    npm install
    ```

2. **Configure environment variables:**
    - Copy `.env.example` to `.env` and fill in your values (MongoDB URI, Stripe keys, AWS S3, etc.).

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
    - Open [http://localhost:5001](http://localhost:5001) in your browser.

### Docker

1. **Build the Docker image:**
    ```sh
    docker build -t my-ecommerce-app .
    ```

2. **Run the container:**
    ```sh
    docker run -p 5001:5001 --env-file .env my-ecommerce-app
    ```

## Scripts

- `npm run build:backend` – Compile backend TypeScript
- `npm run build:frontend` – Compile frontend TypeScript
- `npm start` – Start the Express server

## License

MIT

---

**Note:**  
- Update `.env` with your credentials and keys.
- For Stripe payments, ensure you use your test keys in development.
- For AWS S3, configure credentials in `src/config/s3Client.ts`.
