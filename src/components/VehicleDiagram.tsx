import type { DamageArea } from '../lib/types'

export function VehicleDiagram({ selected, onSelect }: { selected?: DamageArea; onSelect:(a:DamageArea)=>void }) {
  const part=(area:DamageArea, x:number,y:number,w:number,h:number,label:string)=><g onClick={()=>onSelect(area)} className={selected===area?'vehicle-part selected':'vehicle-part'}>
    <rect x={x} y={y} width={w} height={h} rx="10"/><text x={x+w/2} y={y+h/2+4} textAnchor="middle">{label}</text>
  </g>
  return <svg className="vehicle-diagram" viewBox="0 0 760 300" role="img" aria-label="Selector de zona del vehículo">
    <path className="car-outline" d="M135 72h485c42 0 75 34 75 75v18c0 42-33 75-75 75H135c-42 0-75-33-75-75v-18c0-41 33-75 75-75z"/>
    {part('front',610,108,100,95,'Frontal')}
    {part('rear',50,108,100,95,'Trasera')}
    {part('left',165,62,420,62,'Lateral izq.')}
    {part('right',165,176,420,62,'Lateral der.')}
    {part('glass',300,125,165,50,'Cristales')}
    <g onClick={()=>onSelect('wheel')} className={selected==='wheel'?'wheel-group selected':'wheel-group'}>
      <circle cx="205" cy="67" r="24"/><circle cx="550" cy="67" r="24"/><circle cx="205" cy="233" r="24"/><circle cx="550" cy="233" r="24"/><text x="377" y="285" textAnchor="middle">Llantas / ruedas</text>
    </g>
  </svg>
}
