// An optional visual comparison, enabled only by the explicit preview URL.
if(new URLSearchParams(location.search).get('readability')==='1'){
 document.documentElement.dataset.readability='soft';
}
