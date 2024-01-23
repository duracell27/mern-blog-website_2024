import React, { useContext } from "react";
import AnimationWrapper from "../common/page-animation";
import { Toaster, toast } from "react-hot-toast";
import { EditorContext } from "../pages/editor.pages";
import Tag from "./tags.component";
import axios from "axios";
import { UserContext } from "../App";
import { useNavigate, useParams } from "react-router-dom";

const PublishForm = () => {
  let characterLimit = 200;
  let tagLimit = 10
  let {blog_id} = useParams()
  let {
    blog: { banner, title, content, tags, des },
    setEditorState,
    setBlog,
    blog,
  } = useContext(EditorContext);

  let {userAuth: {access_token}} = useContext(UserContext)

  let navigate = useNavigate()

  const handleCloseEvent = () => {
    setEditorState("editor");
  };

  const handleBlogTitleChange = (e) => {
    setBlog({ ...blog, title: e.target.value });
  };

  const handleBlogDesChange = (e) => {
    setBlog({...blog, des: e.target.value})
  }

  const handleTitleKeyDown = (e) => {
    if (e.keyCode == 13) {
      e.preventDefault();
    }
  };

  const handleKeyDown = (e) => {
    if (e.keyCode == 13 || e.keyCode == 188) {
      e.preventDefault()
      let tag = e.target.value

      if(tags.length<tagLimit){
        if(!tags.includes(tag) && tag.length){
          setBlog({ ...blog, tags: [...tags, tag] })
        }
      }else{
        toast.error(`You can add max ${tagLimit} tags`)
      }

      e.target.value = ''
    }
  }

  const publishBlog = (e) => {
    if(e.target.classList.contains('disable')){
      return 
    }
    if(!title.length){
      return toast.error('Write blog title before publish')
    }
    if(!des.length || des.length > characterLimit){
      return toast.error(`Write blog description under ${characterLimit} characters`)
    }
    if(!tags.length || tags.length > tagLimit){
      return toast.error(`Write some blog tags, Max ${tagLimit} tags`)
    }

    let loadingToast = toast.loading("Loading...")
    e.target.classList.add('disable')

    let blogObject = {
      title,
      banner, des, content, tags, draft: false
    }
    
    axios.post(import.meta.env.VITE_SERVER_URL + '/create-blog', {...blogObject, id: blog_id}, {headers:{
      "authorization": `Bearer ${access_token}`
    }}).then(()=>{
      e.target.classList.remove('disable')
      toast.dismiss(loadingToast)
      toast.success('Published 👍')

      setTimeout(()=>{
        navigate('/')
      }, 500)
    }).catch(({response}) =>{
      e.target.classList.remove('disable')
      toast.dismiss(loadingToast)
      toast.error(response.data.error)
    })

  }
  return (
    <AnimationWrapper>
      <section className="w-screen min-h-screen grid items-center lg:grid-cols-2 py-16 lg:gap-4">
        <Toaster />
        <button
          className="w-12 h-12 absolute right-[5vw] z-10 top-[5%] lg:top-[10%]"
          onClick={handleCloseEvent}
        >
          <i className="fi fi-br-cross"></i>
        </button>

        <div className="max-w-[550px] center ">
          <p className="text-dark-grey mb-1">Preview</p>
          <div className="w-full aspect-video rounded-lg overflow-hidden bg-grey mt-4">
            <img src={banner} alt="banner" />
          </div>
          <h1 className="text-4xl font-medium mt-2 leading-tight line-clamp-2">
            {title}
          </h1>
          <p className="font-gelasio line-clamp-2 text-xl leading-7 mt-4">
            {des}
          </p>
        </div>

        <div className="border-grey lg:border-1">
          <p className="text-dark-grey mb-2 mt-9">Blog Title</p>
          <input
            type="text"
            className="input-box pl-4 "
            placeholder="Blog title"
            defaultValue={title}
            onChange={handleBlogTitleChange}
          />
          <p className="text-dark-grey mb-2 mt-9">
            Short description about your blog
          </p>
          <textarea onKeyDown={handleTitleKeyDown} maxLength={characterLimit} defaultValue={des} onChange={handleBlogDesChange} className="h-40 resize-none leading-7 input-box pl-4"></textarea>
          <p className="mt-1 text-dark-grey text-sm text-right ">{characterLimit - des.length} character left</p>
          <p className="text-dark-grey mb-2 mt-9">Topics</p>
          <div className="relative input-box pl-2 py-2 pb-2">
            <input type="text" onKeyDown={handleKeyDown} placeholder="Topic"  className="sticky input-box bg-white top-0 left-0 pl-4 mb-3 focus:bg-white"/>
            {tags.map((tag, ind)=>(
              <Tag key={ind} tagIndex={ind} tag={tag}/>
            ))}
            
          </div>
          <p className="mt-1 mb-4 text-dark-grey text-sm text-right">{tagLimit - tags.length } tags left</p>
          <button onClick={publishBlog} className="btn-dark px-8 ">Publish</button>
        </div>
      </section>
    </AnimationWrapper>
  );
};

export default PublishForm;
