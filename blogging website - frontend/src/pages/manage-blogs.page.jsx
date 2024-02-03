import React, { useState } from 'react'

const ManageBlogs = () => {
    const [blogs, setBlogs] = useState(null)
    const [drafts, setDrafts] = useState(null)
    const [query, setQuery] = useState('')

    // const getBlogs = ({page, draft, deleteDocCount=0}) =>{
    //     axios.post()
    // }

  return (
    <div>ManageBlogs</div>
  )
}

export default ManageBlogs