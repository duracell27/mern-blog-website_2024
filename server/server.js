import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import User from "./Schema/User.js";
import Blog from "./Schema/Blog.js";
import { nanoid } from "nanoid";
import jwt from "jsonwebtoken";
import "dotenv/config";
import cors from "cors";
import admin from "firebase-admin";
import serviceAccountKey from "./blog-website-e67ab-firebase-adminsdk-1ag3d-c8ff1d3a4c.json" assert { type: "json" };
import { getAuth } from "firebase-admin/auth";
import aws from "aws-sdk";

let emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/; // regex for email
let passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,20}$/; // regex for password

const server = express();
let PORT = 3000;
admin.initializeApp({
  credential: admin.credential.cert(serviceAccountKey),
});
server.use(express.json());
server.use(cors());

mongoose.connect(process.env.BD_CONNECT_STRING, { autoIndex: true });

// setting aws

const s3 = new aws.S3({
  region: "eu-north-1",
  accessKeyId: process.env.AWS_ACCESS,
  secretAccessKey: process.env.AWS_SECRET,
});

const verifyJWT = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token === null || token === undefined) {
    return res.status(401).json({ error: "No access token" });
  }

  jwt.verify(token, process.env.SECRET_ACCESS_KEY, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Access token is invalid" });
    }
    req.user = user.id;
    next();
  });
};

const generateUploadURL = async () => {
  const date = new Date();
  const imageName = `${nanoid()}-${date.getTime()}.jpeg`;
  return await s3.getSignedUrlPromise("putObject", {
    Bucket: "blogtutorialyoutube",
    Key: imageName,
    Expires: 1000,
    ContentType: "image/jpeg",
  });
};

const formatDataToSet = (user) => {
  const access_token = jwt.sign(
    { id: user._id },
    process.env.SECRET_ACCESS_KEY
  );
  return {
    access_token: access_token,
    profile_img: user.personal_info.profile_img,
    username: user.personal_info.username,
    fullname: user.personal_info.fullname,
  };
};

const generateUsername = async (email) => {
  let username = email.split("@")[0];

  let isUsernameExists = await User.exists({
    "personal_info.username": username,
  }).then((result) => result);
  isUsernameExists ? (username += nanoid().substring(0, 5)) : "";

  return username;
};

// upload image url

server.get("/get-upload-url", (req, res) => {
  generateUploadURL()
    .then((url) => res.status(200).json({ uploadURL: url }))
    .catch((error) => {
      console.log(error.message);
      return res.status(500).json({ error: error.message });
    });
});

server.post("/signup", (req, res) => {
  const { fullname, email, password } = req.body;
  if (fullname.length < 3) {
    return res
      .status(403)
      .json({ error: "Fullname must be at least 3 characters" });
  }
  if (!email.length) {
    return res.status(403).json({ error: "Enter email address" });
  }
  if (!emailRegex.test(email)) {
    return res.status(403).json({ error: "Email is invalid" });
  }
  if (!passwordRegex.test(password)) {
    return res.status(403).json({
      error:
        "Password should be 6 to 20 characters long, 1 numeric, 1 lowercase and 1 uppercase letters",
    });
  }
  bcrypt.hash(password, 10, async (error, hashed_password) => {
    let username = await generateUsername(email);
    let user = new User({
      personal_info: {
        fullname,
        email,
        password: hashed_password,
        username,
      },
    });
    user
      .save()
      .then((u) => {
        return res.status(200).json(formatDataToSet(u));
      })
      .catch((err) => {
        if (err.code === 11000) {
          return res.status(500).json({ error: "Email already exists" });
        }
        return res.status(500).json({ error: err.message });
      });
  });
});

server.post("/signin", async (req, res) => {
  let { email, password } = req.body;

  User.findOne({ "personal_info.email": email })
    .then((user) => {
      if (!user) {
        return res.status(403).json({ error: "Email not found" });
      }
      if (!user.google_auth) {
        bcrypt.compare(password, user.personal_info.password, (err, result) => {
          if (err) {
            return res
              .status(403)
              .json({ error: "Error occured while login, try again later" });
          }
          if (!result) {
            return res
              .status(403)
              .json({ error: "Incorrect login or password" });
          } else {
            return res.status(200).json(formatDataToSet(user));
          }
        });
      } else {
        return res.status(403).json({
          error: "Account was created with google. Please login with google",
        });
      }
    })
    .catch((err) => {
      return res.status(500).json({ error: err.message });
    });
});

server.post("/google-auth", async (req, res) => {
  let { access_token } = req.body;

  getAuth()
    .verifyIdToken(access_token)
    .then(async (decodedUser) => {
      let { email, name, picture } = decodedUser;
      picture = picture.replace("s96-c", "s384-c");

      console.log("pic", picture);

      let user = await User.findOne({ "personal_info.email": email })
        .select(
          "personal_info.fullname personal_info.username personal_info.profile_img google_auth"
        )
        .then((u) => {
          return u || null;
        })
        .catch((err) => res.status(500).json({ error: err.message }));

      if (user) {
        if (!user.google_auth) {
          return res.status(403).json({
            error:
              "This email was signed up without google. Please login with password",
          });
        }
      } else {
        let username = await generateUsername(email);

        user = new User({
          personal_info: {
            fullname: name,
            email,
            profile_img: picture,
            username,
          },
          google_auth: true,
        });

        await user
          .save()
          .then((u) => {
            user = u;
          })
          .catch((err) => res.status(500).json({ error: err.message }));
      }

      return res.status(200).json(formatDataToSet(user));
    })
    .catch((err) =>
      res.status(500).json({ error: "Filed to authenticate with google" })
    );
});

server.post("/latest-blogs", (req, res) => {
  let { page } = req.body;
  let maxLimit = 5;
  Blog.find({ draft: false })
    .populate(
      "author",
      "personal_info.profile_img personal_info.fullname personal_info.username -_id"
    )
    .sort({ publishedAt: -1 })
    .select("blog_id title des banner activity tags publishedAt -_id")
    .skip((page - 1) * maxLimit)
    .limit(maxLimit)
    .then((blogs) => {
      return res.status(200).json({ blogs });
    })
    .catch((err) => {
      return res.status(500).json({ errors: err.message });
    });
});

server.get("/trending-blogs", (req, res) => {
  Blog.find({ draft: false })
    .populate(
      "author",
      "personal_info.profile_img personal_info.fullname personal_info.username -_id"
    )
    .sort({
      "activity.total_read": -1,
      "activity.total_likes": -1,
      publishedAt: -1,
    })
    .select("blog_id title publishedAt -_id")
    .limit(5)
    .then((blogs) => {
      return res.status(200).json({ blogs });
    })
    .catch((err) => {
      return res.status(500).json({ errors: err.message });
    });
});

server.post("/search-blogs", (req, res) => {
  let { tag } = req.body;

  let findQuery = { tags: tag, draft: false };
  let maxLimit = 5;

  Blog.find(findQuery)
    .populate(
      "author",
      "personal_info.profile_img personal_info.fullname personal_info.username -_id"
    )
    .sort({ publishedAt: -1 })
    .select("blog_id title des banner activity tags publishedAt -_id")
    .limit(maxLimit)
    .then((blogs) => {
      return res.status(200).json({ blogs });
    })
    .catch((err) => {
      return res.status(500).json({ errors: err.message });
    });
});

server.post("/all-latest-blogs-count", (req, res) => {
  Blog.countDocuments({draft: false}).then(count =>{
    res.status(200).json({totalDocs: count});
  }).catch((err) => {
    console.log(err);
    return res.status(500).json({ errors: err.message });
  })
});

server.post("/create-blog", verifyJWT, (req, res) => {
  const authorId = req.user;

  let { title, banner, content, tags, des, draft } = req.body;

  if (!draft) {
    if (!des.length || des.length > 200) {
      return res.status(403).json({
        error: "You must provide a description under the 200 characters",
      });
    }
    if (!banner.length) {
      return res.status(403).json({ error: "You must provide blog bunner" });
    }
    if (!content.blocks.length) {
      return res
        .status(403)
        .json({ error: "You must provide a some blog content" });
    }
    if (!tags.length || tags.length > 10) {
      return res
        .status(403)
        .json({ error: "You must provide some tags. Max 10" });
    }
  }

  if (!title.length) {
    return res.status(403).json({ error: "You must provide a title" });
  }

  tags = tags.map((tag) => tag.toLowerCase());

  let blog_id =
    title
      .replace(/[^a-zA-Z0-9]/g, " ")
      .replace(/\s+/g, "-")
      .trim() + nanoid();

  let blog = new Blog({
    title,
    des,
    banner,
    content,
    tags,
    author: authorId,
    blog_id,
    draft: Boolean(draft),
  });

  blog
    .save()
    .then((blog) => {
      let incrementValue = draft ? 0 : 1;

      User.findOneAndUpdate(
        { _id: authorId },
        {
          $inc: { "account_info.total_posts": incrementValue },
          $push: { blogs: blog._id },
        }
      )
        .then((user) => {
          return res.status(200).json({ id: blog.blog_id });
        })
        .catch((error) => {
          return res
            .status(500)
            .json({ error: "Failed to update total posts and total blogs" });
        });
    })
    .catch((error) => {
      return res.status(500).json({ error: error.messages });
    });
});

server.listen(PORT, () => {
  console.log("listening on port ", PORT);
});
