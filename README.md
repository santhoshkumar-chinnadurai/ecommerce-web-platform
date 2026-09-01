# E-Commerce Web Platform

A full-stack e-commerce web application with product catalog, shopping cart state, and user authentication built with **Node.js**, **Express.js**, **MongoDB (Mongoose)**, and **Docker**.

---

## 📌 Overview

The E-Commerce Web Platform provides end-to-end shopping workflows including user registration, session/JWT authentication, product catalog browsing with price and category filtering, shopping cart persistence, and order checkout simulation.

---

## ✨ Features

- **Product Catalog Management**: Dynamic product catalog with categories, stock tracking, and pricing.
- **Cart & Checkout Engine**: Client-side and server-side cart operations with price calculations.
- **User Authentication**: Secure signup and login using password hashing (Bcrypt) and JWT token validation.
- **RESTful API Architecture**: Modular Express routes for products, users, cart, and orders.
- **Dockerized Infrastructure**: Complete container setup with Docker Compose.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JSON Web Token (JWT), Bcrypt.js
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **DevOps**: Docker, Docker Compose

---

## 💻 Installation & Setup

### Prerequisites
- Node.js v18+
- MongoDB (local or MongoDB Atlas) or Docker

### 1. Run via Docker Compose
```bash
docker-compose up -d
```

### 2. Manual Local Setup
```bash
npm install
npm start
```
The server starts on port `5000`.

---

## 🔐 Environment Variables (.env.example)

Create a `.env` in the root directory:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/ecommerce_db
JWT_SECRET=your_jwt_secret_key_here
```

---

## 📄 License

This project is open-source under the [MIT License](LICENSE).

---

## 👨‍💻 Author

**Santhoshkumar Chinnadurai**  
- **GitHub**: [@santhoshkumar-chinnadurai](https://github.com/santhoshkumar-chinnadurai)  
- **LinkedIn**: [santhoshkumar-chinnadurai](https://www.linkedin.com/in/santhoshkumar-chinnadurai-4b8034344)
