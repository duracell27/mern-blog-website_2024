import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import User from "./Schema/User.js";
import Blog from "./Schema/Blog.js";
import Notification from "./Schema/Notification.js";
import Comment from "./Schema/Comment.js";
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

const deleteComments = (_id) => {
  Comment.findOneAndDelete({ _id })
    .then((comment) => {
      if (comment.parent) {
        Comment.findOneAndUpdate(
          { _id: comment.parent },
          { $pull: { children: _id } }
        )
          .then((data) => console.log(data))
          .catch((err) => console.log(err));
      }
      Notification.findOneAndDelete({ comment: _id })
        .then((notification) => {})
        .catch((err) => console.log(err));

      Notification.findOneAndUpdate({ reply: _id }, {$unset: { reply: 1}})
        .then((notification) => {
          console.log('notif',notification)
        })
        .catch((err) => {
          console.log('from deleete notif',err);
        });

      Blog.findOneAndUpdate(
        { _id: comment.blog_id },
        {
          $pull: { comments: _id },
          $inc: {
            "activity.total_comments": -1,
            "activity.total_parent_comments": comment.parent ? 0 : -1,
          },
        }
      ).then((blog) => {
        if (comment.children.length) {
          comment.children.map((replies) => {
            deleteComments(replies);
          });
        }
      });
    })
    .catch((err) => console.log(err));
};

// upload image url

server.get("/get-upload-url", (req, res) => {
  generateUploadURL()
    .then((url) => res.status(200).json({ uploadURL: url }))
    .catch((error) => {
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

server.post("/change-password", verifyJWT, (req, res) => {
  let { currentPassword, newPassword } = req.body;

  if (
    !passwordRegex.test(currentPassword) ||
    !passwordRegex.test(newPassword)
  ) {
    return res.status(403).json({
      error:
        "Password should be 6 to 20 characters long, 1 numeric, 1 lowercase and 1 uppercase letters",
    });
  }

  User.findOne({ _id: req.user })
    .then((user) => {
      if (user.google_auth) {
        return res
          .status(403)
          .json({
            error: "You can`t change your password if you login with Google",
          });
      }
      bcrypt.compare(
        currentPassword,
        user.personal_info.password,
        (err, result) => {
          if (err) {
            return res
              .status(500)
              .json({
                error:
                  "Some error occurred while trying to change your password",
              });
          }

          if (!result) {
            return res
              .status(403)
              .json({ error: "Incorrect current password" });
          }

          bcrypt.hash(newPassword, 10, async (error, hashed_password) => {
            User.findOneAndUpdate(
              { _id: req.user },
              { "personal_info.password": hashed_password }
            )
              .then((u) => {
                return res.status(200).json({ status: "passwor changed" });
              })
              .catch((err) =>
                res
                  .status(500)
                  .json({
                    error:
                      "Something happened while updating password, try again later",
                  })
              );
          });
        }
      );
    })
    .catch((err) => {
      return res.status(500).json({ error: "User not found" });
    });
});

server.post("/update-profile-img", verifyJWT, (req, res) => {
  let { url } = req.body;

  User.findOneAndUpdate({ _id: req.user }, { "personal_info.profile_img": url })
    .then(() => {
      return res.status(200).json({ profile_img: url });
    })
    .catch((err) => {
      return res.status(500).json({ error: err.message });
    });
});

server.post("/update-profile", verifyJWT, (req, res) => {
  let { username, bio, social_links } = req.body;

  let bioLimit = 150;

  if (username.length < 3) {
    return res
      .status(403)
      .json({ error: "Username should be at least 3 characters long" });
  }
  if (bio.length > bioLimit) {
    return res
      .status(403)
      .json({ error: "Bio should be less than 150 characters long" });
  }
  let social_linksArray = Object.keys(social_links);

  try {
    for (let i = 0; i < social_linksArray.length; i++) {
      if (social_links[social_linksArray[i]].length) {
        let hostName = new URL(social_links[social_linksArray[i]]).hostname;
        if (
          !hostName.includes(`${social_linksArray[i]}.com`) &&
          social_linksArray[i] != "website"
        ) {
          return res
            .status(403)
            .json({
              error: `Social link ${social_linksArray[i]} is invalid. Enter a full link name`,
            });
        }
      }
    }
  } catch (err) {
    return res
      .status(500)
      .json({
        error: "You must provide full social links with http(s) included",
      });
  }

  let updateObject = {
    "personal_info.username": username,
    "personal_info.bio": bio,
    social_links,
  };

  User.findOneAndUpdate({ _id: req.user }, updateObject, {
    runValidators: true
  }).then(()=>{
    return res.status(200).json({username });
  }).catch(err => {
    if(err.code === 110000){
      return res.status(500).json({error: 'Username is already taken'});
    }
    return res.status(500).json({error: err.message});
  })
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
  let { tag, page, query, author, limit, eliminate_blog } = req.body;

  let findQuery;

  if (tag) {
    findQuery = { tags: tag, draft: false, blog_id: { $ne: eliminate_blog } };
  } else if (query) {
    findQuery = { title: new RegExp(query, "i"), draft: false };
  } else if (author) {
    findQuery = { author, draft: false };
  }
  let maxLimit = limit ? limit : 5;

  Blog.find(findQuery)
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

server.post("/all-latest-blogs-count", (req, res) => {
  Blog.countDocuments({ draft: false })
    .then((count) => {
      res.status(200).json({ totalDocs: count });
    })
    .catch((err) => {
      console.log(err);
      return res.status(500).json({ errors: err.message });
    });
});

server.post("/search-blogs-count", (req, res) => {
  let { tag, query, author } = req.body;

  let findQuery;
  if (tag) {
    findQuery = { tags: tag, draft: false };
  } else if (query) {
    findQuery = { title: new RegExp(query, "i"), draft: false };
  } else if (author) {
    findQuery = { author, draft: false };
  }

  Blog.countDocuments(findQuery)
    .then((count) => {
      return res.status(200).json({ totalDocs: count });
    })
    .catch((err) => {
      return res.status(500).json({ errors: err.message });
    });
});

server.post("/search-users", (req, res) => {
  let { query } = req.body;

  User.find({ "personal_info.username": new RegExp(query, "i") })
    .limit(10)
    .select(
      "personal_info.fullname personal_info.username personal_info.profile_img -_id"
    )
    .then((users) => {
      return res.status(200).json({ users });
    })
    .catch((err) => {
      return res.status(500).json({ error: err.message });
    });
});

server.post("/get-profile", (req, res) => {
  let { username } = req.body;

  User.findOne({ "personal_info.username": username })
    .select("-personal_info.password -google_auth -updatedAt -blogs")
    .then((user) => {
      return res.status(200).json(user);
    })
    .catch((err) => {
      return res.status(500).json({ error: err.message });
    });
});

server.post("/create-blog", verifyJWT, (req, res) => {
  const authorId = req.user;

  let { title, banner, content, tags, des, draft, id } = req.body;

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
    id ||
    title
      .replace(/[^a-zA-Z0-9]/g, " ")
      .replace(/\s+/g, "-")
      .trim() + nanoid();

  if (id) {
    Blog.findOneAndUpdate(
      { blog_id },
      { title, des, banner, content, tags, draft: draft ? draft : false }
    )
      .then(() => {
        return res.status(200).json({ id: blog_id });
      })
      .catch((err) => {
        return res.status(500).json({ error: err.message });
      });
  } else {
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
  }
});

server.post("/get-blog", (req, res) => {
  let { blog_id, draft, mode } = req.body;

  let incrementValue = mode !== "edit" ? 1 : 0;

  Blog.findOneAndUpdate(
    { blog_id },
    { $inc: { "activity.total_reads": incrementValue } }
  )
    .populate(
      "author",
      "personal_info.fullname personal_info.username personal_info.profile_img"
    )
    .select("title des content banner activity publishedAt blog_id tags")
    .then((blog) => {
      User.findOneAndUpdate(
        { "personal_info.username": blog.author.personal_info.username },
        { $inc: { "account_info.total_reads": incrementValue } }
      ).catch((err) => {
        return res.status(500).json({ error: err.message });
      });
      if (blog.draft && !draft) {
        return res.status(500).json({ error: "You can't edit draft blog" });
      }
      return res.status(200).json({ blog });
    })
    .catch((err) => {
      return res.status(500).json({ error: err.message });
    });
});

server.post("/like-blog", verifyJWT, (req, res) => {
  let user_id = req.user;
  let { _id, isLikedByUser } = req.body;
  let incrementValue = !isLikedByUser ? 1 : -1;

  Blog.findOneAndUpdate(
    { _id },
    { $inc: { "activity.total_likes": incrementValue } }
  ).then((blog) => {
    if (!isLikedByUser) {
      let like = new Notification({
        type: "like",
        blog: _id,
        notification_for: blog.author,
        user: user_id,
      });

      like.save().then((notification) => {
        return res.status(200).json({ liked_by_user: true });
      });
    } else {
      Notification.findOneAndDelete({ user: user_id, blog: _id, type: "like" })
        .then(() => {
          return res.status(200).json({ liked_by_user: false });
        })
        .catch((err) => {
          return res.status(500).json({ error: err.message });
        });
    }
    // return res.status(200).json({ blog });
  });
  // .catch((err) => {
  //   return res.status(500).json({ error: err.message });
  // });
});

server.post("/isliked-by-user", verifyJWT, (req, res) => {
  let user_id = req.user;

  let { _id } = req.body;

  Notification.exists({ user: user_id, type: "like", blog: _id })
    .then((result) => {
      return res.status(200).json({ result });
    })
    .catch((err) => {
      return res.status(500).json({ error: err.message });
    });
});

server.post("/add-comment", verifyJWT, (req, res) => {
  let user_id = req.user;

  let { _id, comment, blog_author, replying_to,notification_id } = req.body;

  if (!comment.length) {
    return res
      .status(403)
      .json({ error: "You must write something to publish a comment" });
  }

  //creating a comment doc

  let commentObject = {
    blog_id: _id,
    blog_author,
    comment,
    commented_by: user_id,
  };

  if (replying_to) {
    commentObject.parent = replying_to;
    commentObject.isReply = true;
  }

  new Comment(commentObject)
    .save()
    .then(async (commentFile) => {
      let { comment, commentedAt, children } = commentFile;

      Blog.findOneAndUpdate(
        { _id },
        {
          $push: { comments: commentFile._id },
          $inc: {
            "activity.total_comments": 1,
            "activity.total_parent_comments": replying_to ? 0 : 1,
          },
        }
      )
        .then((blog) => {})
        .catch((err) => console.log(err));

      let notificationObject = {
        type: replying_to ? "reply" : "comment",
        blog: _id,
        notification_for: blog_author,
        user: user_id,
        comment: commentFile._id,
      };

      if (replying_to) {
        notificationObject.replied_on_comment = replying_to;

        await Comment.findOneAndUpdate(
          { _id: replying_to },
          { $push: { children: commentFile._id } }
        ).then((replyingToCommentDoc) => {
          notificationObject.notification_for =
            replyingToCommentDoc.commented_by;
        });

        if(notification_id){
          Notification.findOneAndUpdate(
            { _id: notification_id },
            { reply: commentFile._id }
          ).then((notification) => {
            
          });
        }
      }
      console.log('notifi ID',notification_id)
      console.log('replying to', replying_to)
      console.log('before save notification',notificationObject)

      new Notification(notificationObject)
        .save()
        .then((notification) => {});
      return res.status(200).json({
        comment,
        commentedAt,
        _id: commentFile._id,
        user_id,
        children,
      });
    })
    .catch((err) => {
      return res.status(500).json({ error: err.message });
    });
});

server.post("/get-blog-comments", (req, res) => {
  let { blog_id, skip } = req.body;

  let maxLimit = 5;

  Comment.find({ blog_id, isReply: false })
    .populate(
      "commented_by",
      "personal_info.username personal_info.fullname personal_info.profile_img"
    )
    .skip(skip)
    .limit(maxLimit)
    .sort({
      commentedAt: -1,
    })
    .then((comment) => {
      return res.status(200).json(comment);
    })
    .catch((err) => {
      return res.status(500).json({ error: err.message });
    });
});

server.post("/get-replies", (req, res) => {
  let { _id, skip } = req.body;
  let maxLimit = 5;
  Comment.findOne({ _id })
    .populate({
      path: "children",
      options: {
        limit: maxLimit,
        skip: skip,
        sort: {
          commentedAt: -1,
        },
      },
      populate: {
        path: "commented_by",
        select:
          "personal_info.profile_img personal_info.username personal_info.fullname",
      },
      select: "-blog_id -updatedAt",
    })
    .select("children")
    .then((doc) => {
      return res.status(200).json({ replies: doc.children });
    })
    .catch((err) => {
      return res.status(500).json({ error: err.message });
    });
});

server.post("/delete-comment", verifyJWT, (req, res) => {
  let user_id = req.user;
  let { _id } = req.body;

  Comment.findOne({ _id }).then((comment) => {
    if (user_id == comment.commented_by || user_id == comment.blog_author) {
      deleteComments(_id);

      return res.status(200).json({ success: true });
    } else {
      return res.status(403).json({ error: "You can't delete this comment" });
    }
  });
});

server.get('/new-notification', verifyJWT, (req, res) => {
  let user_id = req.user;

  Notification.exists({'notification_for': user_id, seen: false, user: {$ne: user_id}})
  .then((result) => {
      if(result){
        return res.status(200).json({new_notification_available: true});
      }else{
        return res.status(200).json({new_notification_available: false});
      }
    })
  .catch((err) => {
      return res.status(500).json({ error: err.message });
    });
})

server.post('/notifications', verifyJWT, (req, res) => {
  let user_id = req.user;

  let {page, filter, deletedDocCount} = req.body;

  let maxLimit = 10

  let findQuery = {
    notification_for: user_id,
    user: {$ne: user_id}
  }

  let skipDocs = (page-1)*maxLimit

  if(filter != 'all'){
    findQuery.type = filter
  }

  if(deletedDocCount){
    skipDocs -=deletedDocCount
  }

  Notification.find(findQuery)
  .skip(skipDocs)
  .limit(maxLimit)
  .populate('blog', 'title blog_id')
  .populate('user', 'personal_info.fullname personal_info.username personal_info.profile_img')
  .populate('comment', 'comment')
  .populate('replied_on_comment', 'comment')
  .populate('reply', 'comment')
  .sort({createdAt:-1})
  .select('createdAt type seen reply')
  .then(notifications=>{
    return res.status(200).json({notifications})
  }).catch(err=>{
    console.error(err)
    return res.status(500).json({error: err.message})
  })
})

server.post('/all-notifications-count', verifyJWT, (req, res) =>{
  let user_id = req.user
  
  let {filter} = req.body
  let findQuery = {
    notification_for: user_id,
    user: {$ne: user_id}
  }
  if(filter != 'all'){
    findQuery.type = filter
  }
  Notification.countDocuments(findQuery).then(count=>{
    return res.status(200).json({totalDocs: count})
  }).catch(err=>{
    return res.status(500).json({error: err.message})
  })
})

server.post('user-written-blogs', verifyJWT, (req, res) =>{
  let user_id = req.user
  let {page, draft,query,deletedDocCount} = req.body

  let maxLimit = 5

  let skipDocs = (page-1)*maxLimit

  if(deletedDocCount){
    skipDocs -=deletedDocCount
  }

  Blog.find({author: user_id, draft, title: new RegExp(query, 'i')})
  .skip(skipDocs)
  .limit(maxLimit)
  .sort({publishedAt: -1})
  .select("title banner publishedAt blog_id activity des draft -_id")
  .then(blogs=>{
    return res.status(200).json({blogs})
  }).catch(err=>{
    return res.status(500).json({error: err.message})
  })
})

server.post('/user-written-blogs-count', verifyJWT, (req,res)=>{

  let user_id = req.user
  let {draft, query} = req.body

  Blog.countDocuments({author: user_id, draft, title: new RegExp(query, 'i')})
  .then(count=>{
    return res.status(200).json({totalDocs: count})
  }).catch(err=>{
    return res.status(500).json({error: err.message})
  });
  
})

server.listen(PORT, () => {
  console.log("listening on port ", PORT);
});
