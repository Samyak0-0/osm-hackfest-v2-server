import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();

// Middleware to parse JSON requests
app.use(express.json());

app.use(
  cors({
    credentials: true,
    origin: "http://localhost:5173",
    methods: "GET,PUT,POST,DELETE",
  })
);

const MONGO_URL = process.env.MONGO_URL;

mongoose
  .connect(MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((error) => console.error("Error connecting to MongoDB:", error));

const RouteSchema = new mongoose.Schema({
  markerPosition: [
    {
      lt: { type: Number, required: true },
      ln: { type: Number, required: true },
      type: { type: String, required: true },
      namee: { type: String },
    },
  ],
  polyLines: [[Number]],
});

const BusStopSchema = new mongoose.Schema({
  lt: { type: Number, required: true },
  ln: { type: Number, required: true },
});

const CheckPointSchema = new mongoose.Schema({
  lt: { type: Number, required: true },
  ln: { type: Number, required: true },
  namee: { type: String, required: true },
});

// Create Models
const Route = mongoose.model("Route", RouteSchema);
const BusStop = mongoose.model("BusStop", BusStopSchema);
const CheckPoint = mongoose.model("CheckPoint", CheckPointSchema);

// A test route
app.get("/", (req, res) => {
  res.send("Hello, World!");
});

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371; // Earth's radius in kilometers

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
};

app.get("/route", async (req, res) => {
  const { s_lat, s_lon, d_lat, d_lon } = req.query; // Extract search parameters

  // Log the parameters to the console
  console.log("Source Latitude:", s_lat);
  console.log("Source Longitude:", s_lon);
  console.log("Destination Latitude:", d_lat);
  console.log("Destination Longitude:", d_lon);

  const busStops = await BusStop.find({});

  if (busStops.length === 0) {
    return res.status(404).json({ error: "No bus stops found" });
  }

  const closestSourceStop = busStops.reduce(
    (closest, stop) => {
      const distance = haversineDistance(s_lat, s_lon, stop.lt, stop.ln);
      return distance < closest.distance ? { stop, distance } : closest;
    },
    { stop: null, distance: Infinity }
  );

  const closestDestStop = busStops.reduce(
    (closest, stop) => {
      const distance = haversineDistance(d_lat, d_lon, stop.lt, stop.ln);
      return distance < closest.distance ? { stop, distance } : closest;
    },
    { stop: null, distance: Infinity }
  );

  console.log(closestSourceStop, closestDestStop);
  console.log(closestSourceStop.stop.lt)
  console.log(closestSourceStop.stop.ln)

  const query = {
    "markerPosition": {
      $elemMatch: {
        lt: closestSourceStop.stop.lt,
        ln: closestSourceStop.stop.ln,
        type: "busStop"
      }
    }
  };

  const result = await Route.findOne(query);

  res.json({result, closestDestStop, closestSourceStop})
  console.log({ closestSourceStop , closestDestStop, resultt: result })
});

app.post("/addroute", async (req, res) => {
  try {
    const { markerPosition, polyLines } = req.body;

    // console.log(markerPosition, polyLines);

    // Validate request body
    // if (!markerPosition || !polyLines) {
    //   return res
    //     .status(400)
    //     .json({ error: "markerPosition and polyLines are required" });
    // }

    const newRoute = new Route({ markerPosition, polyLines });
    const savedRoute = await newRoute.save();

    res
      .status(201)
      .json({ message: "Route added successfully", data: savedRoute });
  } catch (error) {
    console.error("Error adding route:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/checkbusstop", async (req, res) => {
  try {
    const { lt, ln } = req.body;

    if (lt == null || ln == null) {
      return res
        .status(400)
        .json({ error: "Latitude and longitude are required" });
    }

    const existingStop = await BusStop.findOne({ lt, ln });

    res.json({ exists: !!existingStop });
  } catch (error) {
    console.error("Error checking bus stop:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/checkcheckpoint", async (req, res) => {
  try {
    const { namee } = req.body;

    if (!namee) {
      return res.status(400).json({ error: "Checkpoint name is required" });
    }

    const existingCheckPoint = await CheckPoint.findOne({ namee });

    res.json({ exists: !!existingCheckPoint, checkpoint: existingCheckPoint });
  } catch (error) {
    console.error("Error checking checkpoint by name:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/addcheckpoint", async (req, res) => {
  try {
    const { lt, ln, namee } = req.body;

    if (lt == null || ln == null || !namee) {
      return res
        .status(400)
        .json({ error: "Latitude, longitude, and name are required" });
    }

    // Check if the checkpoint already exists
    const existingCheckPoint = await CheckPoint.findOne({ namee });

    if (existingCheckPoint) {
      return res.status(409).json({ message: "Checkpoint already exists" });
    }

    const newCheckPoint = new CheckPoint({ lt, ln, namee });
    await newCheckPoint.save();

    res
      .status(201)
      .json({ message: "Checkpoint added successfully", data: newCheckPoint });
  } catch (error) {
    console.error("Error adding checkpoint:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// app.post("/deletebus", async (req, res) => {
//   try {
//     const { lt, ln } = req.body;
//     console.log(lt, ln);

//     if (!lt || !ln) {
//       return res
//         .status(400)
//         .json({ error: "Latitude and longitude are required" });
//     }

//     // Find and delete the bus stop
//     const deletedStop = await BusStop.findOneAndDelete({ lt, ln });

//     if (!deletedStop) {
//       return res.status(404).json({ error: "Bus stop not found" });
//     }

//     res.status(200).json({ message: "Bus stop deleted successfully" });
//   } catch (error) {
//     console.error("Error deleting bus stop:", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });

app.delete("/deletebus", async (req, res) => {
  try {
    const { lt, ln } = req.body;

    // Find and delete the bus stop
    const deletedStop = await BusStop.findOneAndDelete({ lt, ln });

    res.status(200).json({ message: "Bus stop deleted successfully" });
  } catch (error) {
    console.error("Error deleting bus stop:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/addbusstop", async (req, res) => {
  try {
    const { lt, ln } = req.body;

    if (lt == null || ln == null) {
      return res
        .status(400)
        .json({ error: "Latitude and longitude are required" });
    }

    // Check if the bus stop already exists
    const existingStop = await BusStop.findOne({ lt, ln });

    if (existingStop) {
      return res.status(409).json({ message: "Bus stop already exists" });
    }

    const newBusStop = new BusStop({ lt, ln });
    await newBusStop.save();

    res
      .status(201)
      .json({ message: "Bus stop added successfully", data: newBusStop });
  } catch (error) {
    console.error("Error adding bus stop:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
