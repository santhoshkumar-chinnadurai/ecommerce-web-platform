require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const DB_NAME = process.env.DB_NAME || "ecommerce_store";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

let db;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function toObjectId(id) {
  if (!ObjectId.isValid(id)) {
    const error = new Error("Invalid id");
    error.status = 400;
    throw error;
  }
  return new ObjectId(id);
}

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role
  };
}

function signToken(user) {
  return jwt.sign(publicUser(user), JWT_SECRET, { expiresIn: "8h" });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
}

function validateProduct(input) {
  const product = {
    name: String(input.name || "").trim(),
    description: String(input.description || "").trim(),
    longDescription: String(input.longDescription || "").trim(),
    category: String(input.category || "").trim(),
    imageUrl: String(input.imageUrl || "").trim(),
    features: Array.isArray(input.features) ? input.features.map((feature) => String(feature).trim()).filter(Boolean) : [],
    specs: input.specs && typeof input.specs === "object" ? input.specs : {},
    price: Number(input.price),
    stock: Number(input.stock)
  };

  if (!product.name || !product.description || !product.category) {
    throw Object.assign(new Error("Name, description, and category are required"), { status: 400 });
  }

  if (!Number.isFinite(product.price) || product.price < 0) {
    throw Object.assign(new Error("Price must be a valid positive number"), { status: 400 });
  }

  if (!Number.isInteger(product.stock) || product.stock < 0) {
    throw Object.assign(new Error("Stock must be a valid whole number"), { status: 400 });
  }

  return product;
}

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!name || !email || password.length < 6) {
      return res.status(400).json({ message: "Name, valid email, and a 6+ character password are required" });
    }

    const existing = await db.collection("users").findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "Email is already registered" });
    }

    const userCount = await db.collection("users").countDocuments();
    const user = {
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: userCount === 0 ? "Admin" : "User",
      createdAt: new Date()
    };

    const result = await db.collection("users").insertOne(user);
    user._id = result.insertedId;

    res.status(201).json({ user: publicUser(user), token: signToken(user) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const user = await db.collection("users").findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json({ user: publicUser(user), token: signToken(user) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/products", async (req, res, next) => {
  try {
    const products = await db.collection("products").find().sort({ createdAt: -1 }).toArray();
    res.json(products);
  } catch (error) {
    next(error);
  }
});

app.post("/api/products", requireAuth, requireRole("Admin"), async (req, res, next) => {
  try {
    const product = {
      ...validateProduct(req.body),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const result = await db.collection("products").insertOne(product);
    res.status(201).json({ ...product, _id: result.insertedId });
  } catch (error) {
    next(error);
  }
});

app.put("/api/products/:id", requireAuth, requireRole("Admin"), async (req, res, next) => {
  try {
    const update = {
      ...validateProduct(req.body),
      updatedAt: new Date()
    };
    const result = await db.collection("products").findOneAndUpdate(
      { _id: toObjectId(req.params.id) },
      { $set: update },
      { returnDocument: "after" }
    );

    if (!result) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/products/:id", requireAuth, requireRole("Admin"), async (req, res, next) => {
  try {
    const result = await db.collection("products").deleteOne({ _id: toObjectId(req.params.id) });
    if (!result.deletedCount) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.post("/api/orders", requireAuth, async (req, res, next) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    const orderItems = [];
    let total = 0;

    for (const item of items) {
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw Object.assign(new Error("Quantity must be a positive whole number"), { status: 400 });
      }

      const product = await db.collection("products").findOne({ _id: toObjectId(item.productId) });

      if (!product) {
        throw Object.assign(new Error("A product in your cart no longer exists"), { status: 404 });
      }

      if (product.stock < quantity) {
        throw Object.assign(new Error(`${product.name} only has ${product.stock} in stock`), { status: 409 });
      }

      const update = await db.collection("products").updateOne(
        { _id: product._id, stock: { $gte: quantity } },
        { $inc: { stock: -quantity }, $set: { updatedAt: new Date() } }
      );

      if (!update.modifiedCount) {
        throw Object.assign(new Error(`${product.name} stock changed. Please refresh your cart.`), { status: 409 });
      }

      const lineTotal = product.price * quantity;
      total += lineTotal;
      orderItems.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        quantity,
        lineTotal
      });
    }

    const order = {
      userId: toObjectId(req.user.id),
      customerName: req.user.name,
      customerEmail: req.user.email,
      items: orderItems,
      total,
      status: "Placed",
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection("orders").insertOne(order);
    const createdOrder = { ...order, _id: result.insertedId };

    res.status(201).json(createdOrder);
  } catch (error) {
    next(error);
  }
});

app.get("/api/orders", requireAuth, async (req, res, next) => {
  try {
    const filter = req.user.role === "Admin" ? {} : { userId: toObjectId(req.user.id) };
    const orders = await db.collection("orders").find(filter).sort({ createdAt: -1 }).toArray();
    res.json(orders);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/orders/:id/status", requireAuth, requireRole("Admin"), async (req, res, next) => {
  try {
    const allowed = ["Placed", "Packed", "Shipped", "Delivered", "Cancelled"];
    const status = String(req.body.status || "").trim();

    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid order status" });
    }

    const result = await db.collection("orders").findOneAndUpdate(
      { _id: toObjectId(req.params.id) },
      { $set: { status, updatedAt: new Date() } },
      { returnDocument: "after" }
    );

    if (!result) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({ message: error.message || "Server error" });
});

async function seedProducts() {
  const products = [
    {
      name: "Canvas Daypack",
      description: "Durable everyday backpack with padded laptop storage.",
      longDescription: "A sturdy daily backpack made for commutes, campus days, and short trips. The structured laptop sleeve, easy-access front pocket, and water-resistant canvas keep essentials organized without feeling bulky.",
      category: "Bags",
      imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=80",
      features: ["Padded 15-inch laptop sleeve", "Water-resistant canvas", "Two quick-access pockets"],
      specs: { Material: "Waxed canvas", Capacity: "22 L", Warranty: "1 year" },
      price: 64.99,
      stock: 24,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      name: "Wireless Desk Lamp",
      description: "Rechargeable lamp with warm dimming and clean metal finish.",
      longDescription: "A compact desk lamp with a rechargeable battery and warm dimming levels for reading, late work, or bedside use. The weighted base keeps it stable while the slim profile keeps your desk clear.",
      category: "Home",
      imageUrl: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=80",
      features: ["Three brightness levels", "USB-C rechargeable", "Warm eye-friendly light"],
      specs: { Battery: "12 hours", Finish: "Powder-coated metal", Charging: "USB-C" },
      price: 39.5,
      stock: 18,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      name: "Ceramic Pour-Over Set",
      description: "Minimal coffee brewer set for slow mornings and rich cups.",
      longDescription: "A ceramic pour-over set designed for balanced extraction and a calm morning ritual. The ridged dripper supports steady flow while the matching server keeps your brew warm at the table.",
      category: "Kitchen",
      imageUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80",
      features: ["Includes dripper and server", "Dishwasher safe", "Fits standard cone filters"],
      specs: { Material: "Glazed ceramic", Capacity: "600 ml", Care: "Dishwasher safe" },
      price: 48,
      stock: 31,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      name: "Noise-Canceling Headphones",
      description: "Comfortable wireless headphones with deep sound and travel mode.",
      longDescription: "Over-ear headphones tuned for focused work, flights, and everyday listening. Active noise canceling softens background sound while plush cushions stay comfortable through long sessions.",
      category: "Electronics",
      imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80",
      features: ["Active noise canceling", "35-hour battery life", "Fold-flat travel design"],
      specs: { Battery: "35 hours", Connection: "Bluetooth 5.3", Weight: "248 g" },
      price: 129,
      stock: 15,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      name: "Stainless Water Bottle",
      description: "Insulated bottle that keeps drinks cold through the workday.",
      longDescription: "A double-wall insulated bottle with a leak-resistant cap and durable stainless finish. It keeps cold drinks crisp and hot drinks ready without sweating in your bag.",
      category: "Wellness",
      imageUrl: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=900&q=80",
      features: ["24-hour cold retention", "Leak-resistant cap", "Cup-holder friendly"],
      specs: { Capacity: "710 ml", Material: "18/8 stainless steel", Care: "Hand wash" },
      price: 28,
      stock: 42,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      name: "Linen Sheet Set",
      description: "Breathable washed linen sheets with a soft, relaxed finish.",
      longDescription: "Naturally breathable linen sheets that get softer with every wash. The set includes a fitted sheet, flat sheet, and two pillowcases for an easy bedroom refresh.",
      category: "Home",
      imageUrl: "https://images.unsplash.com/photo-1616627561839-074385245ff6?auto=format&fit=crop&w=900&q=80",
      features: ["Pre-washed texture", "Naturally breathable", "Includes four pieces"],
      specs: { Fabric: "100% linen", Size: "Queen", Care: "Machine wash cold" },
      price: 118,
      stock: 12,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      name: "Travel Organizer Pouch",
      description: "Compact pouch for chargers, cables, pens, and small gear.",
      longDescription: "A structured organizer that keeps cables, adapters, cards, and daily carry items in place. Elastic loops and mesh sections make it easy to find what you need quickly.",
      category: "Bags",
      imageUrl: "https://images.unsplash.com/photo-1553531384-cc64ac80f931?auto=format&fit=crop&w=900&q=80",
      features: ["Elastic cable loops", "Mesh zip pocket", "Slim suitcase-friendly shape"],
      specs: { Material: "Recycled nylon", Dimensions: "9 x 6 in", Closure: "Zipper" },
      price: 22.5,
      stock: 38,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      name: "Cast Iron Skillet",
      description: "Pre-seasoned skillet for searing, baking, and weeknight cooking.",
      longDescription: "A reliable cast iron skillet with excellent heat retention for crisp edges and even browning. It moves from stovetop to oven and builds a natural nonstick surface over time.",
      category: "Kitchen",
      imageUrl: "https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?auto=format&fit=crop&w=900&q=80",
      features: ["Pre-seasoned surface", "Oven safe", "Even heat retention"],
      specs: { Diameter: "10.25 in", Material: "Cast iron", Care: "Hand wash and oil" },
      price: 34,
      stock: 20,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      name: "Smart Fitness Watch",
      description: "Lightweight watch with activity, sleep, and heart-rate tracking.",
      longDescription: "A slim fitness watch for daily movement goals, workouts, sleep tracking, and notifications. The bright display stays readable outdoors and the battery lasts nearly a week.",
      category: "Electronics",
      imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80",
      features: ["Heart-rate tracking", "Sleep insights", "Water resistant"],
      specs: { Battery: "6 days", Display: "AMOLED", Resistance: "5 ATM" },
      price: 89.99,
      stock: 16,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      name: "Yoga Mat Pro",
      description: "Grippy cushioned mat for yoga, stretching, and floor workouts.",
      longDescription: "A dense exercise mat with a textured surface for stable poses and comfortable floor work. The closed-cell surface is easy to wipe down after class or home workouts.",
      category: "Wellness",
      imageUrl: "https://images.unsplash.com/photo-1592432678016-e910b452f9a2?auto=format&fit=crop&w=900&q=80",
      features: ["Non-slip texture", "Dense joint support", "Easy-clean surface"],
      specs: { Thickness: "6 mm", Length: "72 in", Material: "TPE blend" },
      price: 45,
      stock: 27,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  for (const product of products) {
    await db.collection("products").updateOne(
      { name: product.name },
      { $setOnInsert: product },
      { upsert: true }
    );
  }
}

async function start() {
  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  db = client.db(DB_NAME);

  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("products").createIndex({ name: "text", category: "text" });
  await seedProducts();

  app.listen(PORT, () => {
    console.log(`E-commerce app running at http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error("Failed to start application", error);
  process.exit(1);
});
