import { initializeApp } from "firebase/app";
import { GoogleAuthProvider, getAuth, signInWithPopup } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD257mBuIMti32NqWX8lUekXNBQQ3F0m0A",
  authDomain: "blog-website-e67ab.firebaseapp.com",
  projectId: "blog-website-e67ab",
  storageBucket: "blog-website-e67ab.appspot.com",
  messagingSenderId: "676498255638",
  appId: "1:676498255638:web:6192d0d42ce3671e17aa37",
};

const app = initializeApp(firebaseConfig);

// google auth

const provider = new GoogleAuthProvider();

const auth = getAuth();

export const authWithGoogle = async() =>{
    let user = null

    await signInWithPopup(auth, provider).then((result) =>{
        user = result.user
    }).catch((error)=> console.log(error))

    return user
}