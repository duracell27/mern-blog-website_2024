import React, { useContext, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { UserContext } from "../App";
import axios from "axios";

const NotificationCommentField = ({_id, blog_author, index=undefined, replyingTo=undefined, setReplying, notification_id, notificationData}) => {
  let [comment, setComment] = useState("");

  let {_id: user_id} = blog_author
  let {userAuth: {access_token}} = useContext(UserContext)
  let {notifications, notifications:{results}, setNotifications} = notificationData

  const handleComment = () => {
    
      if (!comment.length) {
        return toast.error("Please type something to post a comment");
      }
  
      axios
        .post(
          import.meta.env.VITE_SERVER_URL + "/add-comment",
          { _id, blog_author: user_id, comment, replying_to: replyingTo, notification_id },
          {
            headers: {
              Authorization: `Bearer ${access_token}`,
            },
          }
        )
        .then(({ data }) => {
            
          setReplying(false)
          results[index].reply = {comment, _id: data._id}
          setNotifications({...notifications, results})
        })
        .catch((err) => console.log(err));
  };

  return (
    <>
      <Toaster />
      <textarea
        onChange={(e) => setComment(e.target.value)}
        value={comment}
        placeholder="Leave a reply..."
        className="input-box pl-5 placeholder:text-dark-grey resize-none h-[150px] overflow-auto"
      ></textarea>
      <button className="btn-dark mt-5 px-10" onClick={handleComment}>
        Reply
      </button>
    </>
  );
};

export default NotificationCommentField;
