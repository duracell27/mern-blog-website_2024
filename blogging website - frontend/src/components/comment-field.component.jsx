import React, { useContext, useState } from "react";
import { UserContext } from "../App";
import toast, { Toaster } from "react-hot-toast";
import axios from "axios";
import { BlogContext } from "../pages/blog.page";

const CommentField = ({
  action,
  index = undefined,
  replyingTo = undefined,
  setReplying,
}) => {
  const [comment, setComment] = useState("");
  let {
    blog,
    setBlog,
    setTotalParentCommentsLoaded,
    blog: {
      _id,
      comments,
      comments: { results: commentsArray },
      activity,
      activity: { total_comments, total_parent_comments },
      author: { _id: blog_author },
    },
  } = useContext(BlogContext);
  let {
    userAuth: { access_token, username, fullname, profile_img },
  } = useContext(UserContext);

  const handleComment = () => {
    if (!access_token) {
      return toast.error("You are not logged in to post a comment");
    }
    if (!comment.length) {
      return toast.error("Please type something to post a comment");
    }

    axios
      .post(
        import.meta.env.VITE_SERVER_URL + "/add-comment",
        { _id, blog_author, comment, replying_to: replyingTo },
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        }
      )
      .then(({ data }) => {
        setComment("");
        data.commented_by = {
          personal_info: { username, profile_img, fullname },
        };

        let newCommentArr;
        if (replyingTo) {
          commentsArray[index].children.push(data._id);
          data.childrenLevel = commentsArray[index].childrenLevel + 1;
          data.parentIndex = index;

          commentsArray[index].isReplyLoaded = true;
          commentsArray.splice(index + 1, 0, data);
          newCommentArr = commentsArray;
          setReplying(false)
        } else {
          data.childrenLevel = 0;
          newCommentArr = [data, ...commentsArray];
        }

        let parentCommentIncrementValue = replyingTo ? 0 : 1;
        setBlog({
          ...blog,
          comments: { ...comments, results: newCommentArr },
          activity: {
            ...activity,
            total_comments: total_comments + 1,
            total_parent_comments:
              total_parent_comments + parentCommentIncrementValue,
          },
        });

        setTotalParentCommentsLoaded(
          (prev) => prev + parentCommentIncrementValue
        );
      })
      .catch((err) => console.log(err));
  };
  return (
    <>
      <Toaster />
      <textarea
        onChange={(e) => setComment(e.target.value)}
        value={comment}
        placeholder="Leave a comment..."
        className="input-box pl-5 placeholder:text-dark-grey resize-none h-[150px] overflow-auto"
      ></textarea>
      <button className="btn-dark mt-5 px-10" onClick={handleComment}>
        {" "}
        {action}
      </button>
    </>
  );
};

export default CommentField;
