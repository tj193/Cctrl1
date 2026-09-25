window.DarbStudentDemo = {
  routes: [
    { id:'route-101', match:96, startArea:'Al-Jadriya', destination:'Mustansiriyah University', pickupWindow:'6:55–7:05 AM', departure:'7:00 AM', arrival:'7:35 AM', seats:3, price:85000, driver:{ name:'Ahmed Ali', initials:'AA', rating:4.8, verified:true }, vehicle:{ model:'Toyota Corolla', year:2022, color:'White' }, days:'Sunday – Thursday', pickupPoint:'Near the main district library' },
    { id:'route-102', match:93, startArea:'Al-Karrada', destination:'University of Baghdad', pickupWindow:'6:40–6:50 AM', departure:'6:45 AM', arrival:'7:25 AM', seats:2, price:90000, driver:{ name:'Sara Kareem', initials:'SK', rating:4.9, verified:true }, vehicle:{ model:'Kia Sportage', year:2021, color:'Silver' }, days:'Sunday – Thursday', pickupPoint:'Karrada Inside, bus stop 3' },
    { id:'route-103', match:89, startArea:'Al-Mansour', destination:'Al-Nahrain University', pickupWindow:'7:00–7:10 AM', departure:'7:05 AM', arrival:'7:45 AM', seats:4, price:78000, driver:{ name:'Omar Hassan', initials:'OH', rating:4.6, verified:true }, vehicle:{ model:'Hyundai Elantra', year:2020, color:'Blue' }, days:'Sunday – Wednesday', pickupPoint:'Al-Dawoodi roundabout' },
    { id:'route-104', match:86, startArea:'Al-Adhamiya', destination:'Mustansiriyah University', pickupWindow:'6:50–7:00 AM', departure:'6:55 AM', arrival:'7:40 AM', seats:1, price:72000, driver:{ name:'Zaid Raad', initials:'ZR', rating:4.7, verified:false }, vehicle:{ model:'Nissan Sunny', year:2019, color:'Black' }, days:'Sunday – Thursday', pickupPoint:'Near the central market' },
    { id:'route-105', match:82, startArea:'Zayouna', destination:'University of Technology', pickupWindow:'7:10–7:20 AM', departure:'7:15 AM', arrival:'7:50 AM', seats:3, price:68000, driver:{ name:'Mariam Nabil', initials:'MN', rating:4.5, verified:true }, vehicle:{ model:'Renault Logan', year:2020, color:'White' }, days:'Sunday – Thursday', pickupPoint:'Zayouna Mall entrance' },
    { id:'route-106', match:78, startArea:'Al-Saydiya', destination:'University of Baghdad', pickupWindow:'6:30–6:45 AM', departure:'6:40 AM', arrival:'7:30 AM', seats:5, price:95000, driver:{ name:'Hussein Abbas', initials:'HA', rating:4.4, verified:true }, vehicle:{ model:'Toyota Hiace', year:2021, color:'White' }, days:'Sunday – Thursday', pickupPoint:'Al-Saydiya main street' }
  ],
  requests: [
    { id:'request-201', routeId:'route-102', status:'pending', created:'Today, 8:12 AM', updated:'2 minutes ago' },
    { id:'request-202', routeId:'route-104', status:'accepted', created:'Yesterday, 6:45 PM', updated:'Today, 7:10 AM' },
    { id:'request-203', routeId:'route-105', status:'rejected', created:'September 21, 4:30 PM', updated:'Yesterday, 9:05 AM' }
  ],
  notifications: [
    { id:'note-1', type:'request', title:'Request accepted', body:'Zaid accepted your seat request.', time:'2 min ago', unread:true, target:'requests' },
    { id:'note-2', type:'message', title:'Message from driver', body:'Ahmed: “Pickup will be beside the main gate.”', time:'18 min ago', unread:true, target:'messages' },
    { id:'note-3', type:'waitlist', title:'New route found', body:'A 94% match is now available for your journey.', time:'1 hr ago', unread:true, target:'waitlist' },
    { id:'note-5', type:'accepted', title:'Request accepted', body:'Your driver accepted the seat request.', time:'Yesterday', unread:false, target:'upcomingRide' },
    { id:'note-6', type:'route', title:'Important route update', body:'The pickup point moved to the north gate.', time:'Yesterday', unread:false, target:'requests' },
    { id:'note-7', type:'rejected', title:'Request rejected', body:'The route is now full. Try another match.', time:'Yesterday', unread:false, target:'requests' },
    { id:'note-8', type:'request', title:'Request sent', body:'Your request was sent successfully.', time:'September 21', unread:false, target:'requests' }
  ]
};
