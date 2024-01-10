import axios from "axios";

export const uploadImage = async (img) => {
  let imageUrl = null;
  await axios
    .get(import.meta.env.VITE_SERVER_URL + "/get-upload-url")
    .then(async ({ data: { uploadURL } }) => {
      await axios({
        method: "PUT",
        url: uploadURL,
        headers: {
          "Content-Type": "multipart/form-data",
        },
        data: img,
      }).then(() => {
        imageUrl = uploadURL.split("?")[0];
      });
    });
  return imageUrl;
};
