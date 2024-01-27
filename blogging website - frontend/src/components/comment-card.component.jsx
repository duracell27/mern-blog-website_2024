import React, { useContext, useState } from "react";
import { getDay } from "../common/date";
import { UserContext } from "../App";
import toast, { Toaster } from "react-hot-toast";
import CommentField from "./comment-field.component";
import { BlogContext } from "../pages/blog.page";
import axios from "axios";

const CommentCard = ({ index, leftVal, commentData }) => {
  let {
    userAuth: { access_token, username },
  } = useContext(UserContext);
  const [isReply, setIsReply] = useState(false);

  let {
    commented_by: {
      personal_info: { profile_img, fullname, username: commented_by_username },
    },
    commentedAt,
    comment,
    _id,
    children,
  } = commentData;

  let {
    blog,
    setBlog,
    blog: {
      comments,
      activity,
      activity: { total_parent_comments },
      comments: { results: commentsArray },
      author: {
        personal_info: { username: blog_author },
      },
    },
    setTotalParentCommentsLoaded,
  } = useContext(BlogContext);

  const handleReplyClick = () => {
    if (!access_token) {
      return toast.error("You are not logged in to reply a comment");
    }
    setIsReply((prev) => !prev);
  };

  const getParentIndex = () => {
    let startingPoint = index - 1;
    try {
      while (
        commentsArray[startingPoint].childrenLevel >= commentData.childrenLevel
      ) {
        startingPoint--;
      }
    } catch {
      startingPoint = undefined;
    }

    return startingPoint;
  };

  const removeCommentsCards = (startingPoint, isDelete = false) => {
    if (commentsArray[startingPoint]) {
      while (
        commentsArray[startingPoint].childrenLevel > commentData.childrenLevel
      ) {
        commentsArray.splice(startingPoint, 1);
        if (!commentsArray[startingPoint]) {
          break;
        }
      }
    }

    if (isDelete) {
      let parentIndex = getParentIndex();
      if (parentIndex !== undefined) {
        commentsArray[parentIndex].children = commentsArray[
          parentIndex
        ].children.filter((child) => child !== _id);
        if (!commentsArray[parentIndex].children.length) {
          commentsArray[parentIndex].isReplyLoaded = false;
        }
      }
      commentsArray.splice(index, 1);
    }
    if (commentData.childrenLevel === 0 && isDelete) {
      setTotalParentCommentsLoaded((prev) => prev - 1);
    }
    setBlog({
      ...blog,
      comments: { results: commentsArray },
      activity: {
        ...activity,
        total_parent_comments:
          total_parent_comments -
          (commentData.childrenLevel === 0 && isDelete ? 1 : 0),
      },
    });
  };

  const hideReplies = () => {
    commentData.isReplyLoaded = false;
    removeCommentsCards(index + 1);
  };

  const deleteComment = (e) => {
    e.target.setAttribute("disabled", true);

    axios
      .post(
        import.meta.env.VITE_SERVER_URL + "/delete-comment",
        { _id },
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        }
      )
      .then(() => {
        e.target.removeAttribute("disabled");
        removeCommentsCards(index + 1, true);
      })
      .catch((err) => console.log(err));
  };

  const loadReplies = ({ skip = 0, currentIndex = index }) => {
    if (commentsArray[currentIndex].children.length) {
      hideReplies();
      axios
        .post(import.meta.env.VITE_SERVER_URL + "/get-replies", {
          _id: commentsArray[currentIndex]._id,
          skip,
        })
        .then(({ data: { replies } }) => {
          commentsArray[currentIndex].isReplyLoaded = true;
          for (let i = 0; i < replies.length; i++) {
            replies[i].childrenLevel =
              commentsArray[currentIndex].childrenLevel + 1;

            commentsArray.splice(currentIndex + 1 + i + skip, 0, replies[i]);
          }

          setBlog({
            ...blog,
            comments: { ...comments, results: commentsArray },
          });
        })
        .catch((error) => {
          console.log(error);
        });
    }
  };

  const LoadMoreRepliesButton = () => {
    let button = <button
    onClick={() =>
      loadReplies({
        skip: index - parentIndex,
        currentIndex: parentIndex,
      })
    }
    className="text-dark-grey p-2 px-3 hover:bg-grey/30 rounded-md flex items-center gap-2"
  >
    Load more replies
  </button>

    let parentIndex = getParentIndex();

    if (commentsArray[index + 1]) {
      console.log('я в першому іф')
      if (
        commentsArray[index + 1].childrenLevel <
        commentsArray[index].childrenLevel
      ) {
        if ((index - parentIndex) < commentsArray[parentIndex].children.length) {
          return button
        }
      }
    } else {
      console.log('я в другому іф')
      console.log('парент індекс', parentIndex)
      if (parentIndex !==undefined) {
        console.log('парент індекс є')
        if ((index - parentIndex) < commentsArray[parentIndex].children.length) {
          return button
        }
      }
    }
  };
  return (
    <div className="w-full" style={{ paddingLeft: `${leftVal * 10}px` }}>
      <Toaster />
      <div className="my-5 p-6 rounded-md border border-grey">
        <div className="flex gap-3 items-center mb-8 ">
          <img
            src={profile_img}
            alt="profile img"
            className="w-6 h-6 rounded-full"
          />
          <p className="line-clamp-1">
            {fullname} @{commented_by_username}
          </p>
          <p className="min-w-fit">{getDay(commentedAt)}</p>
        </div>
        <p className="font-gelasio text-xl ml-3">{comment}</p>
        <div className="flex gap-5 items-center mt-5">
          {commentData.isReplyLoaded ? (
            <button
              className="text-dark-grey p-2 px-3 hover:bg-grey/30 rounded-md flex items-center gap-2"
              onClick={hideReplies}
            >
              <i className="fi fi-rs-comment-dots"></i>Hide Reply
            </button>
          ) : (
            <button
              onClick={loadReplies}
              className="text-dark-grey p-2 px-3 hover:bg-grey/30 rounded-md flex items-center gap-2"
            >
              <i className="fi fi-rs-comment-dots"></i>
              {children.length} Replies
            </button>
          )}
          <button className="underline" onClick={handleReplyClick}>
            Reply
          </button>
          {username === commented_by_username || username === blog_author ? (
            <button
              onClick={deleteComment}
              className="p-2 px-3 rounded-full border border-grey ml-auto hover:bg-red/30 hover:text-red flex items-center"
            >
              <i className="fi fi-rs-trash pointer-events-none"></i>
            </button>
          ) : (
            ""
          )}
        </div>
        {isReply ? (
          <div className="mt-8">
            <CommentField
              action={"reply"}
              index={index}
              replyingTo={_id}
              setReplying={setIsReply}
            />
          </div>
        ) : (
          ""
        )}
      </div>
      <LoadMoreRepliesButton />
    </div>
  );
};

export default CommentCard;
