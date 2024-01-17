import React from 'react'

const LoadMoreDataBtn = ({state, fetchDataFun}) => {
    if(state !== null && state.totalDocs > state.results.length) {
        return (
            <div onClick={()=>fetchDataFun({page: state.page +1})}>
                <button className='text-dark-grey p-2 px-3 hover:bg-grey/30 rounded-md flex items-center gap-2'>Load more</button>
            </div>
          )
    }
  
}

export default LoadMoreDataBtn