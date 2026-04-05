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
    const wishlistCollections = database.collection("wishlist");
    const returnsCollections = database.collection("returns");
    const customerSupportCollections = database.collection("customerSupport");
    const cuponsCollections = database.collection("cupons");

    // user register api

    app.post("/register", async (req, res) => {
      const { email, password, name } = req.body;

      try {
        // validation
        if (!email || !password || !name) {
          return res.status(401).send({ message: "All fields are required" });
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
    // admin  find all users
    app.get("/users", async (req, res) => {
      const { userRole } = req.query;
      console.log(userRole);
      try {
        if (!userRole || userRole !== "admin") {
          return res.send({
            success: false,
            message: "Role not found",
          });
        }
        const result = await usersCollections
          .find({ role: "user" }, { projection: { password: 0 } })
          .toArray();
        res.send({
          success: true,
          result,
          message: "Something Worng",
        });
      } catch (error) {
        res.send({
          success: false,
          message: "Something Worng",
        });
      }
    });

    // user get api
    app.get("/users-roles", async (req, res) => {
      const { email } = req.query;
      try {
        const user = await usersCollections.findOne(
          { email },
          { projection: { password: 0 } },
        );
        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }
        const role = user?.role;
        res.send({
          success: true,
          role,
          message: "SuccessFully Find Role In Database",
        });
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
    app.get("/cart", async (req, res) => {
      const { email } = req.query;
      try {
        const result = await cartCollections
          .find({ buyerEmail: email })
          .toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server error", error });
      }
    });

    // cartpage get api
    app.get("/cartpage", async (req, res) => {
      const { email } = req.query;
      try {
        const result = await cartCollections
          .find({ buyerEmail: email })
          .toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server error", error });
      }
    });

    // cart page delete api
    app.delete("/cartpage", async (req, res) => {
      const { id } = req.query;
      try {
        const data = await cartCollections.deleteOne({ _id: new ObjectId(id) });
        res.send({
          success: true,
          data,
        });
      } catch (error) {
        res.status(401).send({ message: "Server error", error });
      }
    });

    // cart id price & quantity update api here
    app.patch("/cart/:id", async (req, res) => {
      const id = req.params.id;
      const { quantity } = req.body;

      try {
        const findData = await cartCollections.findOne({
          _id: new ObjectId(id),
        });

        if (!findData) {
          return res.send({ success: false, message: "Item not found" });
        }

        const singlePrice = findData.productPrice / findData.totalQuantity;

        const newQty = Math.max(1, quantity);

        const result = await cartCollections.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              totalQuantity: newQty,
              productPrice: singlePrice * newQty,
            },
          },
        );

        res.send({
          success: true,
          result,
        });
      } catch (error) {
        res.status(401).send({ message: "Server error", error });
      }
    });

    // add to cart api

    app.post("/add-to-cart", async (req, res) => {
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
          img,
        } = body;
        if (!productId || !buyerEmail || !totalQuantity || !size) {
          return res.send({
            success: false,
            message: "All fields are required",
          });
        }
        const exitsProduct = await cartCollections.findOne({
          productId,
        });
        if (exitsProduct) {
          return res.send({
            success: false,
            message: "This Products Is Already You Add To Cart ",
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
          return res.status(401).send({
            success: false,
            message: "Selected size not available",
          });
        }

        if (sizeInventory?.quantity < totalQuantity) {
          return res.status(401).send({
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
    app.get("/checkout", async (req, res) => {
      try {
        res.send({
          success: true,
        });
      } catch (error) {
        console.log(error);
      }
    });

    // here is wishlist api

    app.post("/wishlist", async (req, res) => {
      const {
        productId,
        userEmail,
        productPrice,
        productImg,
        productTitle,
        productCategory,
      } = req.body;

      try {
        const userData = {
          productId,
          userEmail,
          productPrice,
          productImg,
          productTitle,
          productCategory,
          wishlistAt: new Date(),
        };
        console.log(userData);
        const exitsProducts = await wishlistCollections.findOne({
          productId,
          userEmail,
        });
        if (exitsProducts) {
          return res.send({
            success: false,
            message: "This Product You Have Alreday Added In Wishlist",
          });
        }

        const result = await wishlistCollections.insertOne(userData);
        res.send({
          success: true,
          result,
          message: "Added In Wishlist",
        });
      } catch (error) {
        res.status(401).send({ message: "Server error", error });
      }
    });

    // wisth list get api
    app.get("/wishlist-data", async (req, res) => {
      const { email } = req.query;

      try {
        if (!email) {
          return res.status(401).send({ message: "Email required" });
        }

        const findWishlist = await wishlistCollections
          .find({ userEmail: email })
          .toArray();

        res.send(findWishlist);
      } catch (error) {
        res.status(500).send({ message: "Server error", error });
      }
    });

    // wish delete api
    app.delete("/wishlist-data", async (req, res) => {
      const { id, email, all } = req.query;

      try {
        if (!email) {
          return res.status(400).send({ message: "Email required" });
        }

        let result;

        if (all === "true") {
          result = await wishlistCollections.deleteMany({
            userEmail: email,
          });
        } else {
          result = await wishlistCollections.deleteOne({
            _id: new ObjectId(id),
            userEmail: email,
          });
        }

        res.send({
          deletedCount: result.deletedCount,
          message: "Wishlist updated",
        });
      } catch (error) {
        res.status(500).send({ message: "Server error", error });
      }
    });

    app.get("/wishlist-show", async (req, res) => {
      const { email } = req.query;

      try {
        if (!email) {
          return res.status(401).send({ message: "Email required" });
        }

        const findWishlist = await wishlistCollections
          .find({ userEmail: email })
          .toArray();

        res.send(findWishlist);
      } catch (error) {
        res.status(500).send({ message: "Server error", error });
      }
    });

    // oder confrims api

    app.post("/orders", async (req, res) => {
      const {
        name,
        address,
        postalcode,
        products,
        totalAmount,
        city,
        orderEmail,
        userEmail,
        paymentMethod,
      } = req.body;

      try {
        const newOrder = {
          orderId: `ORD-${Date.now()}`,

          customerName: name,
          userEmail: userEmail,
          customerEmail: orderEmail,
          shippingAddress: {
            address: address,
            city: city,
            postalCode: postalcode,
            country: "Bangladesh",
          },
          products: products,
          totalAmount: totalAmount,
          paymentMethod: paymentMethod,
          paymentStatus: "Unpaid",
          orderStatus: "Pending",
          deliveryStatus: "Pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const existingOrder = await ordersCollections.findOne({
          email: orderEmail,
          totalAmount: totalAmount,
        });
        if (existingOrder) {
          return res.send({
            success: false,
            message: "You have already oder this products",
          });
        }

        const result = await ordersCollections.insertOne(newOrder);
        const add_delete = await cartCollections.deleteMany({
          buyerEmail: userEmail,
        });

        res.send({
          success: true,
          insertedId: result.insertedId,
          message: "Order placed successfully",
        });
      } catch (error) {
        res.send({
          success: false,
          message: "Somethings Error",
        });
      }
    });

    // oders get api
    app.get("/orders", async (req, res) => {
      const { email, status } = req.query;

      try {
        if (!email) {
          return res.status(400).send({
            success: false,
            message: "Email is required",
          });
        }

        const query = {
          userEmail: email,
        };
        if (!status || status === "All") {
          query.deliveryStatus = "Pending";
        }

        if (status && status !== "All") {
          query.deliveryStatus = status;
        }

        const result = await ordersCollections.find(query).toArray();

        res.send({
          success: true,
          result,
          message: "Orders fetched successfully",
        });
      } catch (error) {
        res.send({
          success: false,
          message: "Something went wrong",
        });
      }
    });

    // admin orders get
    app.get("/admin-orders", async (req, res) => {
      try {
        const result = await ordersCollections.find({}).toArray();
        res.send({
          success: true,
          result,
          message: "SuccessFully Find Data",
        });
      } catch (error) {
        res.send({
          success: false,
          message: "Something went wrong",
        });
      }
    });

    // admin orders status update api here
    app.patch("/admin-orders/:id", async (req, res) => {
      const { id } = req.params;
      const { orderStatus } = req.body;

      try {
        if (!id) {
          return res.send({
            success: false,
            message: "Order ID not found",
          });
        }

        if (!orderStatus) {
          return res.send({
            success: false,
            message: "Order status is required",
          });
        }

        const filter = { _id: new ObjectId(id) };

        const updatedDoc = {
          $set: {
            orderStatus: orderStatus,
            deliveryStatus: orderStatus,
          },
        };

        const result = await ordersCollections.updateOne(filter, updatedDoc);

        res.send({
          success: true,
          result,
          message: "Order status updated successfully",
        });
      } catch (error) {
        res.send({
          success: false,
          message: "Failed to update order status",
          error: error.message,
        });
      }
    });

    // products post api
    app.post("/products", async (req, res) => {
      try {
        const productData = req.body;
        const price = parseFloat(productData.productPrice);
        const dPrice = parseFloat(productData.discountPrice) || 0;

        let discountPercentage = 0;
        if (dPrice > 0 && price > dPrice) {
          discountPercentage = Math.round(((price - dPrice) / price) * 100);
        }

        const totalStock = productData.inventory.reduce(
          (acc, curr) => acc + (parseInt(curr.quantity) || 0),
          0,
        );

        const newProduct = {
          title: productData.productName,
          price: price,
          discountPrice: dPrice,
          discountPercentage: discountPercentage,
          category: productData.productCategory,
          gender: productData.productType,
          description: productData.description,
          img: productData.img,
          thumbnails: productData.thumbnails || [],
          inventory: productData.inventory,
          colors: productData.colors || [],
          onSale: productData.onSale || false,
          stock: totalStock,
          isFeatured: productData.isFeatured || false,
          isNewArrival: true,
          rating: 5.0,
          reviewsCount: 0,
          totalSell: 0,
          createdAt: new Date(),
        };
        const result = await productsCollections.insertOne(newProduct);

        res.send({
          success: true,
          message: "Product initialized successfully into the Vault",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error("Error inserting product:", error);
        res.status(500).send({
          success: false,
          message: "Initialization failed. Database connection error.",
          error: error.message,
        });
      }
    });

    //  returns products api here
    app.post("/returns", async (req, res) => {
      try {
        const data = req.body;

        if (!data?.orderId || !data?.buyerEmail) {
          return res.send({
            success: false,
            message: "Order ID and buyer email are required.",
          });
        }

        const existingReturn = await returnsCollections.findOne({
          orderId: data.orderId,
          buyerEmail: data.buyerEmail,
        });

        if (existingReturn) {
          return res.send({
            success: false,
            message: "Return request already submitted for this order.",
          });
        }
        const ordersExits = await ordersCollections.deleteOne({
          orderId: data.orderId,
          userEmail: data.buyerEmail,
        });

        const returnData = {
          ...data,
          returnStatus: "Pending",
          requestedAt: new Date().toISOString(),
        };

        const result = await returnsCollections.insertOne(returnData);

        res.send({
          success: true,
          result,
          message: "Return request submitted successfully.",
        });
      } catch (error) {
        console.error("Error inserting return request:", error);
        res.send({
          success: false,
          message: "Initialization failed. Database connection error.",
          error: error.message,
        });
      }
    });

    // retuns get api here
    app.get("/my-returns", async (req, res) => {
      try {
        const { email } = req.query;

        if (!email) {
          return res.send({
            success: false,
            message: "Email is required",
          });
        }

        const result = await returnsCollections
          .find({ buyerEmail: email })
          .sort({ requestedAt: -1 })
          .toArray();

        res.send({
          success: true,
          result,
          message: "Returns data fetched successfully",
        });
      } catch (error) {
        console.error("Error fetching returns:", error);

        res.send({
          success: false,
          message: "Failed to fetch returns data",
          error: error.message,
        });
      }
    });

    // admin returns get api here
    app.get("/admin-returns", async (req, res) => {
      try {
        const result = await returnsCollections
          .find({})
          .sort({ requestedAt: -1 })
          .toArray();
        res.send({
          success: true,
          result,
          message: "Returns data fetched successfully",
        });
      } catch (error) {
        console.error("Error fetching returns:", error);
        res.send({
          success: false,
          message: "Failed to fetch returns data",
          error: error.message,
        });
      }
    });

    // admin return status update api here
    app.patch("/admin-returns/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { returnStatus } = req.body;
        console.log(id, returnStatus);

        const result = await returnsCollections.updateOne(
          { _id: id },
          { $set: { returnStatus } },
        );

        if (!result.matchedCount) {
          return res.send({
            success: false,
            message: "Return request not found",
          });
        }

        res.send({
          success: true,
          message: "Return status updated successfully",
        });
      } catch (error) {
        console.error("Error updating return status:", error);
        res.send({
          success: false,
          message: "Failed to update return status",
          error: error.message,
        });
      }
    });

    // cupons post api here
    app.post("/coupons", async (req, res) => {
      try {
        const data = req.body;

        // validation
        if (!data.couponCode || !data.discountValue) {
          return res.send({
            success: false,
            message: "Coupon code and discount value are required",
          });
        }

        const existing = await cuponsCollections.findOne({
          couponCode: data.couponCode,
        });

        if (existing) {
          return res.send({
            success: false,
            message: "Coupon already exists",
          });
        }

        const couponData = {
          ...data,
          couponCode: data.couponCode.toUpperCase(),
          usedCount: 0,
          status: "Active",
          createdAt: new Date().toISOString(),
        };

        const result = await cuponsCollections.insertOne(couponData);

        res.send({
          success: true,
          result,
          message: "Coupon created successfully",
        });
      } catch (error) {
        console.error(error);
        res.send({
          success: false,
          message: "Failed to create coupon",
          error: error.message,
        });
      }
    });
    // cupons get api here
    app.get("/coupons", async (req, res) => {
      try {
        const result = await cuponsCollections
          .find({})
          .sort({ createdAt: -1 })
          .toArray();

        res.send({
          success: true,
          result,
          message: "Coupons fetched successfully",
        });
      } catch (error) {
        console.error("Error fetching coupons:", error);

        res.send({
          success: false,
          message: "Failed to fetch coupons",
          error: error.message,
        });
      }
    });
    app.patch("/coupons/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const {
          status,
          couponCode,
          discountValue,
          expiryDate,
          minimumOrderAmount,
          usageLimit,
          perUserLimit,
          applicableCategories,
          description,
        } = req.body;

        const result = await cuponsCollections.updateOne(
          { _id: id },
          {
            $set: {
              status,
              couponCode,
              discountValue,
              expiryDate,
              minimumOrderAmount,
              usageLimit,
              perUserLimit,
              applicableCategories,
              description,
            },
          },
        );

        if (!result.matchedCount) {
          return res.send({
            success: false,
            message: "Coupon not found",
          });
        }

        res.send({
          success: true,
          message: "Coupon updated successfully",
        });
      } catch (error) {
        console.error("Error updating coupon:", error);
        res.send({
          success: false,
          message: "Failed to update coupon",
          error: error.message,
        });
      }
    });

    // dashboard data api here
    app.get("/admin-dashboard-stats", async (req, res) => {
      try {
        const totalUsers = await usersCollections.countDocuments();
        const totalProducts = await productsCollections.countDocuments();
        const totalOrders = await ordersCollections.countDocuments();
        const totalRevenueAgg = await ordersCollections
          .aggregate([
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: "$totalAmount" },
              },
            },
          ])
          .toArray();
        const totalRevenue = totalRevenueAgg[0]?.totalRevenue || 0;
        res.send({
          success: true,
          data: {
            totalUsers,
            totalProducts,
            totalOrders,
            totalRevenue,
          },
          message: "Dashboard data fetched successfully",
        });
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        res.send({
          success: false,
          message: "Failed to fetch dashboard data",
          error: error.message,
        });
      }
    });

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
