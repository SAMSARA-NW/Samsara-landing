const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
test('cart photos and impact follow current Shopify quantities, including removals',()=>{
const counter={},bar={classList:{toggle(name,value){bar.visible=value}}};const toasts=[];const window={__samsaraAddTrees:n=>toasts.push(n)};
vm.runInNewContext(fs.readFileSync('js/shopify-cart.js','utf8'),{window,URL,document:{baseURI:'https://samsara-landing-psi.vercel.app/index.html',getElementById:id=>id==='tree-impact-count'?counter:bar}});
function item(id,quantity,image=null){return {quantity,variant:{image,product:{id:'gid://shopify/Product/'+id}}}}
const cart={model:{lineItems:[]},imageForLineItem:()=> 'shopify-image'};window.SamsaraCart.prepare(cart);window.SamsaraCart.syncImpact(cart);assert.equal(bar.visible,false);
for(const id of ['9105424580836','9105424777444'])assert.equal(cart.imageForLineItem(item(id,1)),'https://samsara-landing-psi.vercel.app/assets/images/1l-1.jpg');assert.equal(cart.imageForLineItem(item('9105424580836',1,{})),'shopify-image');
cart.model.lineItems=[item('9105424679140',1),item('9105424580836',2),item('9105424777444',1)];window.SamsaraCart.syncImpact(cart);assert.equal(counter.textContent,8);assert.deepEqual(toasts,[8]);
cart.model.lineItems[1].quantity=1;window.SamsaraCart.syncImpact(cart);assert.equal(counter.textContent,7);assert.deepEqual(toasts,[8]);
cart.model.lineItems=[];window.SamsaraCart.syncImpact(cart);assert.equal(counter.textContent,0);assert.equal(bar.visible,false);
});
