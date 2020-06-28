import { h } from 'preact';

export default () => {
  try {
    if (localStorage['busroutersg.noads'] === '1') {
      return '';
    }
  } catch (e) {}
  return null;
  // return (
  //   <div>
  //     <style>{`
  //       #carbonads {
  //         display: block;
  //         overflow: hidden;
  //         font-size: 14px;
  //         line-height: 1.4;
  //         padding: 14px;
  //         background-color: rgba(0,0,0,.03);
  //       }
  //       #carbonads span {
  //         position: relative;
  //         display: block;
  //         overflow: hidden;
  //       }
  //       #carbonads a {
  //         color: inherit;
  //         text-decoration: none;
  //       }
  //       .carbon-img {
  //         float: left;
  //         margin-right: 1em;
  //       }
  //       .carbon-img img {
  //         display: block;
  //         line-height: 1;
  //       }
  //       .carbon-poweredby {
  //         position: absolute;
  //         right: 0;
  //         bottom: 0;
  //         opacity: .7;
  //         font-size: smaller;
  //       }
  //     `}</style>
  //     <script
  //       async
  //       type="text/javascript"
  //       src="//cdn.carbonads.com/carbon.js?serve=CK7DPK3J&placement=busroutersg"
  //       id="_carbonads_js"
  //     />
  //   </div>
  // );
};
