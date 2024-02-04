import React, { useContext, useEffect, useState } from "react";
import { UserContext } from "../App";
import { filterPaginationData } from "../common/filter-pagination-data";
import axios from "axios";
import Loader from "../components/loader.component";
import AnimationWrapper from "../common/page-animation";
import NoDataMessage from "../components/nodata.component";
import NotificationsCard from "../components/notification-card.component";
import LoadMoreDataBtn from "../components/load-more.component";

const Notifications = () => {
  let {
    userAuth: { access_token },
  } = useContext(UserContext);
  const [filter, setFilter] = useState("all");
  const [notifications, setNotifications] = useState(null);
  let filters = ["all", "like", "comment", "reply"];

  const handleFilter = (e) => {
    let btn = e.target;
    setFilter(btn.innerHTML);
    setNotifications(null);
  };

  const fetchNotifications = ({ page, deletedDocCount = 0 }) => {
    axios
      .post(
        import.meta.env.VITE_SERVER_URL + "/notifications",
        { page, filter, deletedDocCount },
        {
          headers: { Authorization: "Bearer " + access_token },
        }
      )
      .then(async ({ data: { notifications: data } }) => {
        let formatedData = await filterPaginationData({
          state: notifications,
          data,
          page,
          countRoute: "/all-notifications-count",
          data_to_send: { filter },
          user: access_token,
        });
        setNotifications(formatedData);
        
      })
      .catch((err) => {
        console.log(err);
      });
  };

  useEffect(() => {
    if (access_token) {
      fetchNotifications({ page: 1 });
    }
  }, [access_token, filter]);
  return (
    <div>
      <h1 className="max-md:hidden">Recent Notifications</h1>
      <div className="my-8 flex gap-6 ">
        {filters.map((filterName, i) => {
          return (
            <button
              key={i}
              onClick={handleFilter}
              className={`py-2 ${
                filterName == filter ? "btn-dark" : "btn-light"
              }`}
            >
              {filterName}
            </button>
          );
        })}
      </div>

        {
            notifications == null ? <Loader/> : 
            <>
            {notifications.results.length ? notifications.results.map((notification, i)=>{
                return <AnimationWrapper key={i} transition={{delay: i*0.08}}>
                    <NotificationsCard data={notification} index={i} notificationState={{notifications, setNotifications}} />
                </AnimationWrapper>
            }):<NoDataMessage message={'Nothing avaliable'}/>}
            <LoadMoreDataBtn state={notifications} fetchDataFun={fetchNotifications} additionalParam={{deletedDocCount: notifications.deletedDocCount}}/>
            </>
        }

    </div>
  );
};

export default Notifications;
