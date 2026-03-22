const express = require("express");
const app = express();
const port = 3000;
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

require("dotenv").config();
app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  }),
);

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.USER_NAME}:${process.env.USER_PASSWORD}@cluster0.zgnatwl.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyToken = (req, res, next) => {
  try {
    const token =
      req.headers.authorization?.split(" ")[1] || req.cookies?.token;
    // console.log("after chechk token", token);

    if (!token) {
      return res.status(401).send({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).send({ message: "Invalid token" });
  }
};
async function run() {
  try {
    await client.connect();

    // here we will create a database and collection and add some data to it
    const database = client.db(process.env.DATABASE_NAME);
    const productsCollections = database.collection("products");
    const usersCollections = database.collection("users");
    const ordersCollections = database.collection("orders");
    const cartCollections = database.collection("cart");

    // user register api

    app.post("/register", async (req, res) => {
      const { email, password, name } = req.body;

      try {
        // validation
        if (!email || !password || !name) {
          return res.status(400).send({ message: "All fields are required" });
        }

        // check existing user
        const existingUser = await usersCollections.findOne({ email });
        if (existingUser) {
          return res.send({ message: "User already exists" });
        }

        // hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        const usersData = {
          name,
          email,
          password: hashedPassword,
          role: "user",
          createdAt: new Date(),
        };

        const userInsert = await usersCollections.insertOne(usersData);
        res.send({
          userInsert,
          message: "User registered successfully",
        });
      } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Error registering user" });
      }
    });

    // user log in api

    app.post("/login", async (req, res) => {
      const { email, password } = req.body;

      try {
        // validation
        if (!email || !password) {
          return res.send({ message: "Email and password required" });
        }

        const user = await usersCollections.findOne({ email });

        if (!user) {
          return res.send({ message: "User not found" });
        }

        // password compare
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
          return res.send({ message: "Wrong password" });
        }

        // JWT token generate
        const token = jwt.sign(
          { email: user.email, id: user._id },
          process.env.JWT_SECRET,
          { expiresIn: "1d" },
        );
        res.cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
        });

        res.send({
          message: "Login successful",
          token,
        });
      } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Login error" });
      }
    });

    // view profile get api
    app.get("/profile", verifyToken, async (req, res) => {
      try {
        const user = await usersCollections.findOne(
          { email: req.user.email },
          { projection: { password: 0 } },
        );

        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }

        res.send(user);
      } catch (error) {
        res.status(500).send({ message: "Error fetching profile" });
      }
    });

    // user log out api
    app.post("/logout", (req, res) => {
      res.clearCookie("token", {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
      });

      res.send({ message: "Logged out successfully" });
    });

    // here we will create a get api to get all the products from the database

    app.get("/products", async (req, res) => {
      const cursor = await productsCollections.find({}).toArray();
      res.send(cursor);
    });

    // collection page api
    app.get("/products-collections", async (req, res) => {
      const { category, size } = req.query;
      if (size) {
        const allData = await productsCollections
          .find({ "inventory.size": size })
          .toArray();
        return res.send(allData);
      }
      if (!category || category === "all") {
        const allData = await productsCollections.find({}).toArray();
        return res.send(allData);
      }
      if (size) {
        const allData = await productsCollections
          .find({ "inventory.size": size })
          .toArray();
        return res.send(allData);
      }

      if (category === "MEN" && !size) {
        const menData = await productsCollections
          .find({ gender: "MEN" })
          .toArray();
        return res.send(menData);
      }
      if (category === "MEN" && size) {
        const menData = await productsCollections
          .find({
            gender: "MEN",
            "inventory.size": size,
          })
          .toArray();

        return res.send(menData);
      }
      if (category === "WOMEN" && !size) {
        const menData = await productsCollections
          .find({ gender: "WOMEN" })
          .toArray();

        return res.send(menData);
      }

      if (category === "WOMEN" && size) {
        const menData = await productsCollections
          .find({ gender: "WOMEN", "inventory.size": size })
          .toArray();

        return res.send(menData);
      }
      if (category && size) {
        const menData = await productsCollections
          .find({ category, "inventory.size": size })
          .toArray();

        return res.send(menData);
      }

      const cursor = await productsCollections.find({ category }).toArray();
      res.send(cursor);
    });

    // single data api
    app.get("/products/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const query = { _id: new ObjectId(id) };

        const product = await productsCollections.findOne(query);

        if (!product) {
          return res.status(404).send({ message: "Product not found" });
        }

        res.send(product);
      } catch (error) {
        res.status(500).send({ message: "Server error", error });
      }
    });

    // app.get("/home-collections", async (req, res) => {
    //   try {

    //     const page = parseInt(req.query.page) || 1;
    //     const limit = parseInt(req.query.limit) || 8;

    //     const skip = (page - 1) * limit;

    //     const total = await productsCollections.countDocuments();

    //     const products = await productsCollections
    //       .find()
    //       .skip(skip)
    //       .limit(limit)
    //       .toArray();

    //     res.send({
    //       products,
    //       total,
    //       page,
    //       totalPages: Math.ceil(total / limit),
    //     });
    //   } catch (error) {
    //     console.log(error);
    //     res.status(500).send({ message: "Server error" });
    //   }
    // });

    //home collections

    app.get("/home-collections", async (req, res) => {
      const { gender } = req.query;

      if (!gender || gender === "all") {
        const allData = await productsCollections.find({}).toArray();
        return res.send(allData);
      }
      if (gender === "T-SHIRTS") {
        const shirtsData = await productsCollections
          .find({ category: "T-SHIRTS" })
          .toArray();
        return res.send(shirtsData);
      }

      const result = await productsCollections.find({ gender }).toArray();
      res.send(result);
    });

    // nwe arrival products api
    app.get("/new-arrivals", async (req, res) => {
      const cursor = await productsCollections
        .find({ isNewArrival: true })
        .toArray();
      res.send(cursor);
    });




    //cart data show 
    app.get("/cart", async (req,res)=>{
      const {email}= req.query
     const result = await cartCollections.find({buyerEmail: email}).toArray();
      res.send(result)

    })

    // cartpage get api
    app.get("/cartpage", async (req,res)=>{
      const {email}= req.query
     const result = await cartCollections.find({buyerEmail: email}).toArray();
      res.send(result)

    })

    // cart page delete api
    app.delete("/cartpage", async (req,res)=>{
      const {id} = req.query
      const data = await cartCollections.deleteOne({_id: new ObjectId(id)})
      res.send({
        success:true,
        data
      })
      })

    // add to cart api




    app.post("/orders", async (req, res) => {
      const body = req.body;
      try {
        const {
          productId,
          buyerEmail,
          totalQuantity,
          size,
          productName,
          productCategory,
          status,
          deliveryStatus,
          paymentStatus,
          productPrice,
          productType,
          img
        } = body;
        if (!productId || !buyerEmail || !totalQuantity || !size) {
          return res.send({
            success: false,
            message: "All fields are required",
          });
        }

        const aviableProduct = await productsCollections.findOne({
          _id: new ObjectId(productId),
        });
        if (!aviableProduct) {
          return res.send({
            success: false,
            message: "This Products Not Aviable Right Now",
          });
        }
        const stockProduct = aviableProduct?.stock;
        if (stockProduct < totalQuantity) {
          return res.send({
            success: false,
            message: "Right Now This Quantity Not Aviable",
          });
        }

        const sizeInventory = aviableProduct?.inventory?.find(
          (item) => item.size === size,
        );

        if (!sizeInventory) {
          return res.status(400).send({
            success: false,
            message: "Selected size not available",
          });
        }

        if (sizeInventory?.quantity < totalQuantity) {
          return res.status(400).send({
            success: false,
            message: "Not enough stock for this size",
          });
        }

        const order = {
          productId,
          buyerEmail,
          totalQuantity,
          size,
          productName,
          productCategory,
          productPrice,
          img,
          productType,
          status: status || "Pending",
          deliveryStatus: deliveryStatus || "Pending",
          paymentStatus: paymentStatus || "Unpaid",
          cardAt: new Date(),
        };

        //  Insert order
        const result = await cartCollections.insertOne(order);

        //Update stock
        await productsCollections.updateOne(
          { _id: new ObjectId(productId), "inventory.size": size },
          {
            $inc: {
              stock: -totalQuantity,
              "inventory.$.quantity": -totalQuantity,
            },
          },
        );

        res.send({
          success: true,
          message: "Order placed successfully",
          orderId: result.insertedId,
        });
      } catch (error) {
        console.log(error);
      }
    });

    // chechkout api
    app.get('/checkout', async (req,res)=>{
      try {

        res.send({
        success: true
      })
        
      } catch (error) {
        console.log(error)
        
      }
    })

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
