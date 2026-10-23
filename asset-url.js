// Match dynamically loaded local assets to the release that served this page.
export function assetURL(value){
 const url=new URL(value,document.baseURI);
 const version=document.querySelector('meta[name="site-version"]')?.content;
 if(!version||url.origin!==location.origin||!/^https?:$/.test(url.protocol))return value;
 url.searchParams.set('v',version);
 return url.href;
}
