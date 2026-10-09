const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');

/** Exercise confirmed cart snapshots, not button-click arithmetic. */
test('Celium rehabilitation totals follow cart changes, restore and expiry',()=>{
 const elements={'tree-impact-count':{},'tree-impact-label':{},'tree-impact-bar':{classList:{toggle(_,v){elements.visible=v}}}};
 const toasts=[];let receive;
 const context={module:{exports:{}},window:{addEventListener(name,fn){assert.equal(name,'celium:cart-updated');receive=fn},__samsaraAddTrees:n=>toasts.push(n)},document:{getElementById:id=>elements[id],querySelector:()=>null}};
 vm.runInNewContext(fs.readFileSync('js/celium-cart.js','utf8'),context);
 const handles=['5l','1l','750ml'];
 context.module.exports.registerProducts(handles.map((size,i)=>({handle:size+'-extra-virgin-organic-olive-oil',variants:[{id:'variant-'+i}]})));
 const snapshot=(quantities,reason='update')=>receive({detail:{reason,cart:{lines:quantities.map((quantity,i)=>({variantId:'variant-'+i,quantity}))}}});
 snapshot([0,0,0],'restore');assert.equal(elements.visible,false);
 snapshot([2,0,3],'add');assert.equal(elements['tree-impact-count'].textContent,13);assert.deepEqual(toasts,[13]);
 snapshot([2,1,3]);assert.equal(elements['tree-impact-count'].textContent,14);assert.deepEqual(toasts,[13,1]);
 snapshot([1,1,3]);assert.equal(elements['tree-impact-count'].textContent,9);assert.deepEqual(toasts,[13,1]);
 snapshot([0,0,1]);assert.equal(elements['tree-impact-count'].textContent,1);assert.equal(elements['tree-impact-label'].textContent,'olive tree');
 snapshot([2,1,3],'restore');assert.equal(elements['tree-impact-count'].textContent,14);assert.deepEqual(toasts,[13,1]);
 receive({detail:{reason:'restore',cart:{lines:[{variantId:'unknown',quantity:100}]}}});assert.equal(elements['tree-impact-count'].textContent,0);
 snapshot([-1,0,0]);assert.equal(elements['tree-impact-count'].textContent,0);
 receive({detail:{cart:null,reason:'restore'}});assert.equal(elements.visible,false);assert.equal(elements['tree-impact-label'].textContent,'olive trees');
});
