import React, { useContext, useState } from 'react'
import { getDay } from '../common/date'
import { UserContext } from '../App'
import toast, { Toaster } from 'react-hot-toast'
import CommentField from './comment-field.component'

const CommentCard = ({index, leftVal, commentData}) => {
    let {userAuth: {access_token}} = useContext(UserContext)
    const[isReply, setIsReply] = useState(false)

    let {commented_by : {personal_info: {profile_img, fullname, username}}, commentedAt, comment, _id} = commentData

    const handleReplyClick = () => {
        if(!access_token){
            return toast.error("You are not logged in to reply a comment")
        }
        setIsReply(prev=>!prev)
    }
  return (
    <div className='w-full' style={{paddingLeft: `${leftVal*10}px`}}>
        <Toaster/>
        <div className="my-5 p-6 rounded-md border border-grey">
            <div className="flex gap-3 items-center mb-8 ">
                <img src={profile_img} alt="profile img" className='w-6 h-6 rounded-full'/>
                <p className='line-clamp-1'>{fullname} @{username}</p>
                <p className='min-w-fit'>{getDay(commentedAt)}</p>
            </div>
            <p className='font-gelasio text-xl ml-3'>{comment}</p>
            <div className="flex gap-5 items-center mt-5">

            <button className='underline' onClick={handleReplyClick}>Reply</button>
            </div>
            {isReply?(
                <div className="mt-8">
                    <CommentField action={'reply'} index={index} replyingTo={_id} setReplying={setIsReply}/>
                </div>
            ):''}
        </div>
    </div>
  )
}

export default CommentCard