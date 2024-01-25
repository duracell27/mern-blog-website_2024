import React, { useContext, useEffect } from "react";
import { BlogContext } from "../pages/blog.page";
import { UserContext } from "../App";
import { Link } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import axios from "axios";

const BlogInteraction = () => {
  let {
    blog,
    blog: {
      _id,
      title,
      blog_id,
      activity,
      activity: { total_likes, total_comments },
      author: {
        personal_info: { username: author_username },
      },
    },
    setBlog,
    isLikedByUser,
    setIsLikedByUser,
    commentsWrapper, setCommentsWrapper
  } = useContext(BlogContext);

  let {
    userAuth: { username, access_token },
  } = useContext(UserContext);

  useEffect(() => {
    if (access_token) {
      axios.post(
        import.meta.env.VITE_SERVER_URL + "/isliked-by-user",
        { _id },
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        }
      ).then(({data: {result}})=>{
        setIsLikedByUser(Boolean(result))
      }).catch(err => {
        console.log(err)
      });
    }
  }, []);

  const handleLike = () => {
    if (access_token) {
      setIsLikedByUser((prev) => !prev);
      !isLikedByUser ? total_likes++ : total_likes--;
      setBlog({ ...blog, activity: { ...activity, total_likes } });
      axios
        .post(
          import.meta.env.VITE_SERVER_URL + "/like-blog",
          { _id, isLikedByUser },
          {
            headers: {
              Authorization: `Bearer ${access_token}`,
            },
          }
        )
        .then(({ data }) => {
          console.log(data);
        })
        .catch((err) => {
          console.log(err);
        });
    } else {
      toast.error("Please login to like this post");
    }
  };
  return (
    <>
      <Toaster />
      <hr className="border-grey my-2" />
      <div className="flex gap-6 justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleLike}
            className={
              "w-10 h-10 rounded-full flex items-center justify-center " +
              (isLikedByUser ? " bg-red/20 text-red " : " bg-grey/80")
            }
          >
            <i
              className={
                "fi " + (isLikedByUser ? " fi-sr-heart" : " fi-rr-heart")
              }
            ></i>
          </button>
          <p className="text-xl text-dark-grey">{total_likes}</p>

          <button onClick={()=>setCommentsWrapper(prev=>!prev)} className="w-10 h-10 rounded-full flex items-center justify-center bg-grey/80">
            <i className="fi fi-rr-comment-dots"></i>
          </button>
          <p className="text-xl text-dark-grey">{total_comments}</p>
        </div>
        <div className="flex gap-6 items-center ">
          {username === author_username ? (
            <Link
              className="underline hover:text-purple"
              to={`/editor/${blog_id}`}
            >
              edit
            </Link>
          ) : null}
          <Link
            to={`https://twitter.com/intent/tweet?Read ${title}&url=${location.href}`}
          >
            <i className="fi fi-brands-twitter text-xl hover:text-twitter"></i>
          </Link>
        </div>
      </div>
      <hr className="border-grey my-2" />
    </>
  );
};

export default BlogInteraction;
