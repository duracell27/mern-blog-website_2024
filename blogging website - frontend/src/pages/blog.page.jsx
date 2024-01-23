import React, { createContext, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import AnimationWrapper from "../common/page-animation";
import Loader from "../components/loader.component";
import { getDay } from "../common/date";
import BlogInteraction from "../components/blog-interaction.component";
import BlogPostCard from "../components/blog-post.component";
import BlogContent from "../components/blog-content.component";

export const blogStructure = {
  title: "",
  des: "",
  content: [],
  activity: {},
  banner: "",
  author: { personal_info: {} },
  publishedAt: "",
};

export const BlogContext = createContext()

const BlogPage = () => {
  const { blog_id } = useParams();

  const [blog, setBlog] = useState(blogStructure);
  const [similarBlogs, setSimilarBlogs] = useState(null);
  const [loading, setLoading] = useState(true);

  let {
    title,
    des,
    content,
    banner,
    author: {
      personal_info: { fullname, username:author_username, profile_img },
    },
    publishedAt,
  } = blog;

  const fetchBlog = () => {
    axios
      .post(import.meta.env.VITE_SERVER_URL + "/get-blog", { blog_id })
      .then(({ data: { blog } }) => {
        
        axios.post(import.meta.env.VITE_SERVER_URL + '/search-blogs', {tag: blog.tags[0], limit: 6, eliminate_blog: blog_id}).then(({data})=>{
          setSimilarBlogs(data.blogs)
        })

        setBlog(blog);
        setLoading(false);
      })
      .catch((err) => {
        console.log(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    resetState()
    fetchBlog();
  }, [blog_id]);

  const resetState = () => {
    setBlog(blogStructure);
    setSimilarBlogs(null);
    setLoading(true);
  }

  return (
    <AnimationWrapper>
      {loading? <Loader/>:(
        <BlogContext.Provider value={{blog, setBlog}}>
        <div className="max-w-[900px] center py-10 max-lg:px-[5vw]">
          <img src={banner} alt="blogbanner" className="aspect-video"/>
          <div className="mt-12">
            <h2>{title}</h2>
            <div className="flex max-sm:flex-col justify-between my-8">
              <div className="flex gap-5 items-start ">
                <img src={profile_img} alt="profileImg"  className="h-12 w-12 rounded-full"/>
                <p className="capitalize">{fullname}
                <br />@
                <Link className="underline" to={`/user/${author_username}`}>{author_username}</Link></p>
              </div>
              <p className="text-dark-grey opacity-70 max-sm:mt-6 max-sm:ml-12 max-sm:pl-5">Published on {getDay(publishedAt)}</p>
            </div>
          </div>
          <BlogInteraction />
          
          <div className="my-12 font-gelasio blog-page-content">
            {content[0].blocks.map((block,i) =>(
              <div key={i} className="my-4 md:my-8">
                <BlogContent block={block} />
              </div>
            ))}
          </div>

          <BlogInteraction />

{(similarBlogs !== null && similarBlogs.length )? (
  
  <>
  <h1 className="text-2xl mt-14 mb-10">Similar Blogs</h1>
  {similarBlogs.map((blog,i)=>{
    let {author: {personal_info}} = blog

    return (
      <AnimationWrapper key={i} transition={{duration: 1, delay: 0.08*i}}>
        <BlogPostCard content={blog} author={personal_info}/>
      </AnimationWrapper>
    )
  })}
  </>
  
  ):null}

        </div>
        </BlogContext.Provider>)} 
    </AnimationWrapper>
  );
};

export default BlogPage;
