import React, { useEffect, useRef, useState } from "react";

export let activeTabLineRef
export let activeTabRef

const InPageNavigation = ({
  routes,
  children,
  defaultHidden = [],
  defautActiveIndex = 0,
}) => {
  activeTabLineRef = useRef();
  activeTabRef = useRef();
  let [inPageNavIndex, setInPageNavIndex] = useState(defautActiveIndex);

  useEffect(() => {
    changePageState(activeTabRef.current, defautActiveIndex);
  }, []);

  const changePageState = (btn, i) => {
    let { offsetWidth, offsetLeft } = btn;
    activeTabLineRef.current.style.width = offsetWidth + "px";
    activeTabLineRef.current.style.left = offsetLeft + "px";
    setInPageNavIndex(i);
  };
  return (
    <>
      <div className="relative mb-8 bg-white border-b border-grey flex flex-nowwrap overflow-x-auto">
        {routes.map((route, i) => {
          return (
            <button
              ref={i === defautActiveIndex ? activeTabRef : null}
              onClick={(e) => changePageState(e.target, i)}
              key={i}
              className={
                "p-4 px-5 capitalize " +
                (inPageNavIndex === i ? "text-black " : "text-dark-grey ") +
                (defaultHidden.includes(route) ? " md:hidden " : " ")
              }
            >
              {route}
            </button>
          );
        })}
        <hr ref={activeTabLineRef} className="absolute bottom-0 duration-300" />
      </div>
      {Array.isArray(children) ? children[inPageNavIndex]: children}
    </>
  );
};

export default InPageNavigation;
