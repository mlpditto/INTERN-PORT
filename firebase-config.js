// เอาค่าที่ได้จาก Step 1 มาวางทับตรงนี้
  const firebaseConfig = {
    apiKey: "AIzaSyCnyZoNfk_YE7TfLeEXFo9GgA-QMj3tv6Q",
    authDomain: "intern-port-edfa7.firebaseapp.com",
    projectId: "intern-port-edfa7",
    storageBucket: "intern-port-edfa7.firebasestorage.app",
    messagingSenderId: "367076866368",
    appId: "1:367076866368:web:9c6559652cb0a78ddce2a5",
    measurementId: "G-5R5CEKCN44"
  };

// เริ่มต้นการทำงาน Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();