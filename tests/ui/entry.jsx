import React, {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AppShell} from '../../src/components/app-shell';
import {RegisterWorkspace} from '../../src/components/register-workspace';
import {PartForm} from '../../src/components/part-form';
import {PartDetail} from '../../src/components/part-detail';
import {PageHeader} from '../../src/components/ui';
import Dashboard from '../../src/app/(app)/dashboard/page';
import {membership,options,organisationId,items,usePathname,Link} from './mocks';
function App(){const path=usePathname();const [dashboard,setDashboard]=useState(null);useEffect(()=>{Dashboard().then(setDashboard);},[]);return <><div className="fixed bottom-0 right-0 z-50 bg-black px-2 text-[10px] text-white">Synthetic data · Local UI verification</div><AppShell membership={membership}>{path==='/dashboard'?dashboard:path==='/parts/new'?<><PageHeader title="Add part" eyebrow="Field capture"/><PartForm organisationId={organisationId} role="admin"/></>:path.startsWith('/parts/')?<PartDetail initialItem={items[0]} role="admin"/>:<><PageHeader title="Parts register" eyebrow="Catalogue" description="Valeron · Demo yard" action={<Link href="/parts/new" className="btn-primary">Add Part</Link>}/><RegisterWorkspace role="admin" options={options}/></>}</AppShell></>;}
createRoot(document.getElementById('root')).render(<App/>);
