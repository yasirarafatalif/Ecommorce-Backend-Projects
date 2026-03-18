const express = require("express");
const app = express();
const port = 3000;
const cors = require("cors");
app.use(cors());

require("dotenv").config();
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

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection

    // here we will create a database and collection and add some data to it
    const database = client.db(process.env.DATABASE_NAME);
    const productsCollections = database.collection("products");

    // here we will create a get api to get all the products from the database

    app.get("/products", async (req, res) => {
      const cursor = await productsCollections.find({}).toArray();
      res.send(cursor);
    });

    // collection page api
    app.get("/products-collections", async (req, res) => {
      const { category, size } = req.query;
       if (size) {
        const allData = await productsCollections.find({"inventory.size": size,}).toArray();
        return res.send(allData);
      }
      if (!category || category === "all") {
        const allData = await productsCollections.find({}).toArray();
        return res.send(allData);
      }
      if (size) {
        const allData = await productsCollections.find({"inventory.size": size,}).toArray();
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
          .find({ gender: "WOMEN" ,"inventory.size": size, })
          .toArray();

        return res.send(menData);
      }
      if (category && size) {
        const menData = await productsCollections
          .find({ category,"inventory.size": size, })
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
