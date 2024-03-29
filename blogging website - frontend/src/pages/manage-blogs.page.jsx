import React, { useContext, useEffect, useState } from "react";
import { UserContext } from "../App";
import { filterPaginationData } from "../common/filter-pagination-data";
import axios from "axios";
import { Toaster } from "react-hot-toast";
import InPageNavigation from "../components/inpage-navigation.component";
import Loader from "../components/loader.component";
import NoDataMessage from "../components/nodata.component";
import AnimationWrapper from "../common/page-animation";
import {
  ManageDraftBlogCard,
  ManagePublishedBlogCard,
} from "../components/manage-blogcard.component";
import LoadMoreDataBtn from "../components/load-more.component";
import { useSearchParams } from "react-router-dom";

const ManageBlogs = () => {
  let activeTab = useSearchParams()[0].get('tab')
  let {
    userAuth: { access_token },
  } = useContext(UserContext);
  const [blogs, setBlogs] = useState(null);
  const [drafts, setDrafts] = useState(null);
  const [query, setQuery] = useState("");

  const getBlogs = ({ page, draft, deletedDocCount = 0 }) => {
    axios
      .post(
        import.meta.env.VITE_SERVER_URL + "/user-written-blogs",
        { page, draft, query, deletedDocCount },
        {
          headers: {
            authorization: "Bearer " + access_token,
          },
        }
      )
      .then(async ({ data }) => {
        let formattedData = await filterPaginationData({
          state: draft ? drafts : blogs,
          data: data.blogs,
          page,
          user: access_token,
          countRoute: "/user-written-blogs-count",
          data_to_send: { draft, query },
        });

        if (draft) {
          setDrafts(formattedData);
        } else {
          setBlogs(formattedData);
        }
      })
      .catch((err) => {
        console.log(err);
      });
  };

  useEffect(() => {
    if (access_token) {
      if (blogs == null) {
        getBlogs({ page: 1, draft: false });
      }
      if (drafts == null) {
        getBlogs({ page: 1, draft: true });
      }
    }
  }, [access_token, blogs, drafts, query]);

  const handleChange = (e) => {
    if (!e.target.value.length) {
      setQuery("");
      setBlogs(null);
      setDrafts(null);
    }
  };

  const handleSearch = (e) => {
    let searchQuery = e.target.value;
    setQuery(searchQuery);
    if (e.keyCode == 13 && searchQuery.length) {
      setBlogs(null);
      setDrafts(null);
    }
  };
  return (
    <>
      <h1 className="max-md:hidden">ManageBlogs</h1>
      <Toaster />
      <div className="relative max-md:mt-5 md:mt-8 mb-10">
        <input
          type="search"
          className="w-full bg-grey p-4 pl-12 pr-6 rounded-full placeholder:text-dark-grey"
          placeholder="Search blogs"
          onKeyDown={handleSearch}
          onChange={handleChange}
        />
        <i className="fi fi-rr-search absolute right-[10%] md:left-5 top-1/2 md:pointer-events-none -translate-y-1/2 text-xl text-dark-grey"></i>
      </div>
      <InPageNavigation defautActiveIndex={activeTab != 'draft'?0:1} routes={["Published blogs", "Drafts"]}>
        {blogs == null ? (
          <Loader />
        ) : blogs.results.length ? (
          <>
            {blogs.results.map((blog, i) => (
              <AnimationWrapper key={i} transition={{ delay: i * 0.08 }}>
                <ManagePublishedBlogCard
                  blog={{ ...blog, index: i, setStateFuc: setBlogs }}
                />
              </AnimationWrapper>
            ))}
            <LoadMoreDataBtn state={blogs} fetchDataFun={getBlogs} additionalParam={{draft:false, deletedDocCount: blogs.deletedDocCount}}/>
          </>
        ) : (
          <NoDataMessage message={"No published blogs"} />
        )}

        {drafts == null ? (
          <Loader />
        ) : drafts.results.length ? (
          <>
            {drafts.results.map((blog, i) => (
              <AnimationWrapper key={i} transition={{ delay: i * 0.08 }}>
                <ManageDraftBlogCard
                  blog={{ ...blog, index: i , setStateFuc: setDrafts }}
                />
              </AnimationWrapper>
            ))}
            <LoadMoreDataBtn state={drafts} fetchDataFun={getBlogs} additionalParam={{draft:true, deletedDocCount: drafts.deletedDocCount}}/>
          </>
        ) : (
          <NoDataMessage message={"No published drafts"} />
        )}
      </InPageNavigation>
    </>
  );
};

export default ManageBlogs;
