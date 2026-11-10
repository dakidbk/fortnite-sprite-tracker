export const outfits = {
  forest: {name:'Forest', coat:'#313c37', hood:'#465b51', accent:'#95afa0'},
  ember: {name:'Ember', coat:'#883b37', hood:'#ac5748', accent:'#f5b884'},
  glacier: {name:'Glacier', coat:'#354d85', hood:'#476caa', accent:'#a5d7ed'},
  violet: {name:'Violet', coat:'#614177', hood:'#845c99', accent:'#dab4f5'},
  neon: {name:'Neon Runner', coat:'#23343d', hood:'#316072', accent:'#5df4dc', price:45, type:'ARCADE COLLECTION'},
  varsity: {name:'Crimson Varsity', coat:'#a12b48', hood:'#53213d', accent:'#ffd496', price:75, type:'STORE EXCLUSIVE'},
  gold: {name:'Midnight Gold', coat:'#29243d', hood:'#47395d', accent:'#ffce64', price:110, type:'AFTER HOURS EDITION'}
};
export const shopOutfits = Object.keys(outfits).filter(id => outfits[id].price);
export const skinTones = [
  {name:'Warm', skin:'#bf876d', lightSkin:'#d99d81'},
  {name:'Deep', skin:'#865342', lightSkin:'#aa715a'},
  {name:'Light', skin:'#d5a186', lightSkin:'#eeb699'},
  {name:'Copper', skin:'#a86b54', lightSkin:'#c68b71'}
];
export const hairColors = [
  {name:'Chestnut', hair:'#372b26', hairLight:'#805a45'},
  {name:'Espresso', hair:'#261e25', hairLight:'#51404b'},
  {name:'Plum', hair:'#443248', hairLight:'#896c8e'},
  {name:'Blue Black', hair:'#201f2b', hairLight:'#4a4863'}
];
const starterOutfits = ['forest','ember','glacier','violet'];

export function savedLook(raw, owned) {
  let look;
  try { look = JSON.parse(raw); } catch {}
  if (Number.isInteger(look) && starterOutfits[look]) {
    return {outfit:starterOutfits[look],skin:look,hair:look};
  }
  const outfit = look?.outfit;
  return {
    outfit:starterOutfits.includes(outfit) || owned.includes(outfit) ? outfit : 'forest',
    skin:Number.isInteger(look?.skin) && skinTones[look.skin] ? look.skin : 0,
    hair:Number.isInteger(look?.hair) && hairColors[look.hair] ? look.hair : 0
  };
}

export function avatarPalette(look) {
  return {...outfits[look.outfit],...skinTones[look.skin],...hairColors[look.hair]};
}
