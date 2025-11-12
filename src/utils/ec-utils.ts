import CryptoJS from 'crypto-js';
import Config from 'react-native-config';

export const handleEncrypt = (dataToEncrypt:string) => {
      const secretKey = (Config?.REACT_APP_E_KEY || '') as string;
      var utf8SecretKey = CryptoJS.enc.Utf8.parse(secretKey);
      var utf8DataToEncrypt = CryptoJS.enc.Utf8.parse(dataToEncrypt);
      // Encrypt
      const encrypted = CryptoJS.AES.encrypt(utf8DataToEncrypt, utf8SecretKey,{
        mode: CryptoJS.mode.ECB ,padding: CryptoJS.pad.Pkcs7,
      }).toString();
      //end
    return encrypted;
};

export const encryptJson=(json:any)=> {
  const encryptedJson = handleEncrypt(JSON.stringify(json));
  return encryptedJson;
}

export const encryptJsonKeyValue=(json:any)=> {
    const encryptedJson = {};
    for (const [key, value] of Object.entries(json)) {
      const encryptedKey = handleEncrypt(key);
      const encryptedValue = handleEncrypt(value as string);

      encryptedJson[encryptedKey] = encryptedValue;
    }
  
    return encryptedJson;
}


export const handleDecrypt = (dataToDecrypt:string) => {
  const secretKey = (Config?.REACT_APP_E_KEY || '') as string;
      var utf8SecretKey = CryptoJS.enc.Utf8.parse(secretKey);

    const decrypted = CryptoJS.AES.decrypt(dataToDecrypt, utf8SecretKey, {
      mode: CryptoJS.mode.ECB ,padding: CryptoJS.pad.Pkcs7,
    }).toString(CryptoJS.enc.Utf8);
    return decrypted;
};

export const decryptJson=(json:any)=> {
  const decryptedJson = handleDecrypt(json);
  return JSON.parse(decryptedJson);
}

export const decryptJsonKeyValue=(json:any)=> {
    const decryptedJson = {};
    for (const [key, value] of Object.entries(json)) {
      const decryptedKey = handleDecrypt(key);
      const decryptedValue = handleDecrypt(value as string);
      decryptedJson[decryptedKey] = decryptedValue;
    }
  
    return decryptedJson;
  }


  //for Routing

  export const handleUrlParamEncrypt = (dataToEncrypt:string) => {
    const secretKey = (Config?.REACT_APP_E_KEY || '') as string;
          var utf8SecretKey = CryptoJS.enc.Utf8.parse(secretKey);
      var utf8DataToEncrypt = CryptoJS.enc.Utf8.parse(dataToEncrypt);

      const encrypted = CryptoJS.AES.encrypt(utf8DataToEncrypt, utf8SecretKey,{
        mode: CryptoJS.mode.ECB ,padding: CryptoJS.pad.Pkcs7,
      });
      
      const encryptedBase64 = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(encrypted.toString()));
    return encryptedBase64;
};


export const handleUrlParamDecrypt = (dataToDecrypt:string) => {
  const secretKey = (Config?.REACT_APP_E_KEY || '') as string;
    var utf8SecretKey = CryptoJS.enc.Utf8.parse(secretKey);
  const decodedData = CryptoJS.enc.Base64.parse(dataToDecrypt).toString(CryptoJS.enc.Utf8);;

  const decrypted = CryptoJS.AES.decrypt(decodedData, utf8SecretKey, {
    mode: CryptoJS.mode.ECB ,padding: CryptoJS.pad.Pkcs7,
  });
  const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);  
  return decryptedText;
};