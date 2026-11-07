const foodIcons: Record<string,string> = {
 banana:'banana',avocado:'avocado',bread:'bread',strawberry:'strawberry',spinach:'leaf',tomato:'tomato',egg:'egg',
 'avo-toast':'avocado','egg-sandwich':'bread','berry-pancakes':'cake','green-smoothie':'leaf','tomato-toast':'tomato',
 'bananas-foster-toast':'banana','banana-bread':'bread','guac-bowl':'avocado','strawberry-shortcake':'cake',shakshuka:'egg',panzanella:'salad',
};
export function Icon({name,size=20,className=''}:{name:string;size?:number;className?:string}){
 return <img src={`/graphics/icons/${name}.svg`} width={size} height={size} className={`ui-icon ${className}`} alt="" aria-hidden="true"/>;
}
export function FoodIcon({id,size=24,className=''}:{id:string;size?:number;className?:string}){
 return <Icon name={foodIcons[id]??'box'} size={size} className={`food-icon ${className}`}/>;
}
