import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Grid, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import PaymentsRounded from '@mui/icons-material/PaymentsRounded';
import ReceiptLongRounded from '@mui/icons-material/ReceiptLongRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import { useNavigate } from 'react-router';
import { getLandlordTransactions } from '../../services/api';
import { downloadXlsx } from '../../utils/excel';

const money=(v:unknown)=>`₹${Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:2})}`;
const nice=(v:unknown)=>String(v||'—').replaceAll('_',' ').replace(/\b\w/g,l=>l.toUpperCase());
const dt=(v:unknown)=>{if(!v)return'—';const d=new Date(String(v));return Number.isNaN(d.getTime())?'—':d.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});};
const idOf=(v:any)=>String(v?._id||v||'');

export default function LandlordTransactionsPage(){
  const navigate=useNavigate();
  const [rows,setRows]=useState<Record<string,any>[]>([]);
  const [summary,setSummary]=useState<Record<string,number>>({});
  const [pagination,setPagination]=useState({page:1,pages:1,total:0,limit:25});
  const [filters,setFilters]=useState({q:'',type:'all',status:'all',verificationStatus:'all'});
  const [applied,setApplied]=useState(filters);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  async function load(page=1){setLoading(true);setError('');try{const r=await getLandlordTransactions({...applied,page,limit:pagination.limit});setRows(r.data||[]);setSummary(r.summary||{});setPagination(r.pagination||{page,pages:1,total:0,limit:25});}catch(e){setError((e as Error).message||'Could not load transactions');}finally{setLoading(false);}}
  useEffect(()=>{void load(1);},[applied.q,applied.type,applied.status,applied.verificationStatus]);

  const excelRows=useMemo(()=>[['Date & Time','Payer','Property','Room / Unit','Type','Amount','Paid Amount','Method','Transaction ID','Payment Status','Verification Status','Invoice Number','Tenancy Number'],...rows.map(r=>[dt(r.paidAt||r.paymentVerification?.submittedAt||r.createdAt),String(r.payer?.name||r.payer?.email||'Tenant'),String(r.property?.title||r.property?.name||''),String(r.rentalUnit?.name||r.rentalUnit?.roomNumber||''),nice(r.type),Number(r.amount||0),Number(r.paidAmount||0),nice(r.method),String(r.transactionId||''),nice(r.status),nice(r.paymentVerification?.status),String(r.invoiceNumber||''),String(r.tenancy?.tenancyNumber||'')])],[rows]);

  const status=(r:any)=>{const v=String(r.paymentVerification?.status||'').toLowerCase(),s=String(r.status||'').toLowerCase();if(s==='paid'||v==='approved')return <Chip size="small" color="success" label="Paid"/>;if(v==='submitted')return <Chip size="small" color="info" label="Awaiting Approval"/>;if(v==='rejected')return <Chip size="small" color="error" label="Rejected"/>;if(s==='overdue')return <Chip size="small" color="error" label="Overdue"/>;return <Chip size="small" color="warning" label={nice(s||v||'pending')}/>;};

  return <Box data-secureasset-landlord-transactions="v223" sx={{maxWidth:1450,mx:'auto',px:{xs:1.5,md:2.5},pb:5,fontFamily:'"Open Sans", Arial, sans-serif'}}>
    <Stack direction={{xs:'column',md:'row'}} justifyContent="space-between" alignItems={{md:'center'}} gap={1.2} sx={{mb:2}}>
      <Box><Button size="small" startIcon={<ArrowBackRounded/>} onClick={()=>navigate(-1)}>Back</Button><Typography sx={{fontSize:{xs:22,md:28},fontWeight:850,color:'#12394F'}}>Transactions</Typography><Typography color="text.secondary" sx={{fontSize:12}}>Monitor all payments received by your landlord account, who paid them, status, and transaction date/time.</Typography></Box>
      <Button variant="outlined" startIcon={<DownloadRounded/>} disabled={!rows.length} onClick={()=>void downloadXlsx('landlord-transactions.xlsx','Transactions',excelRows)}>Export Excel</Button>
    </Stack>
    <Grid container spacing={1.2} sx={{mb:1.5}}>
      {[['Total records',pagination.total,ReceiptLongRounded],['Total received',money(summary.totalPaid||0),PaymentsRounded],['Awaiting approval',summary.pendingCount||0,PaymentsRounded],['Rejected',summary.rejectedCount||0,PaymentsRounded]].map(([l,v,I]:any)=><Grid key={l} size={{xs:6,md:3}}><Paper variant="outlined" sx={{p:1.5,borderRadius:2.5}}><Stack direction="row" justifyContent="space-between"><Box><Typography color="text.secondary" sx={{fontSize:10.5}}>{l}</Typography><Typography sx={{mt:.4,fontSize:18,fontWeight:850}}>{v}</Typography></Box><I sx={{color:'primary.main'}}/></Stack></Paper></Grid>)}
    </Grid>
    <Paper variant="outlined" sx={{p:1.2,borderRadius:2.5,mb:1.5}}><Grid container spacing={1}>
      <Grid size={{xs:12,md:5}}><TextField fullWidth size="small" label="Search transaction / payer" value={filters.q} onChange={e=>setFilters(v=>({...v,q:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter')setApplied({...filters});}}/></Grid>
      <Grid size={{xs:6,md:2}}><TextField select fullWidth size="small" label="Type" value={filters.type} onChange={e=>setFilters(v=>({...v,type:e.target.value}))}>{['all','rent','deposit','lease','sale','refund','other'].map(v=><MenuItem key={v} value={v}>{nice(v)}</MenuItem>)}</TextField></Grid>
      <Grid size={{xs:6,md:2}}><TextField select fullWidth size="small" label="Payment" value={filters.status} onChange={e=>setFilters(v=>({...v,status:e.target.value}))}>{['all','paid','pending','overdue','failed'].map(v=><MenuItem key={v} value={v}>{nice(v)}</MenuItem>)}</TextField></Grid>
      <Grid size={{xs:8,md:2}}><TextField select fullWidth size="small" label="Review" value={filters.verificationStatus} onChange={e=>setFilters(v=>({...v,verificationStatus:e.target.value}))}>{[['all','All review'],['submitted','Awaiting approval'],['approved','Approved'],['rejected','Rejected'],['awaiting_tenant','Awaiting tenant']].map(([v,l])=><MenuItem key={v} value={v}>{l}</MenuItem>)}</TextField></Grid>
      <Grid size={{xs:4,md:1}}><Button fullWidth variant="contained" startIcon={<SearchRounded/>} onClick={()=>setApplied({...filters})} sx={{height:40}}>Search</Button></Grid>
    </Grid></Paper>
    {error&&<Alert severity="error" sx={{mb:1.5}}>{error}</Alert>}
    {loading?<Box sx={{minHeight:220,display:'grid',placeItems:'center'}}><CircularProgress size={28}/></Box>:rows.length?<Stack spacing={.9}>{rows.map(r=><Paper key={idOf(r)} variant="outlined" sx={{p:1.35,borderRadius:2.5}}><Grid container spacing={1} alignItems="center">
      <Grid size={{xs:12,md:3}}><Typography sx={{fontSize:12.5,fontWeight:850}}>{r.payer?.name||'Tenant'}</Typography><Typography color="text.secondary" sx={{fontSize:10.5}}>{r.invoiceNumber||r.transactionId||idOf(r).slice(-10)}</Typography></Grid>
      <Grid size={{xs:7,md:2.5}}><Typography sx={{fontSize:11.5,fontWeight:800}}>{r.property?.title||r.property?.name||'Property'}</Typography><Typography color="text.secondary" sx={{fontSize:10.3}}>{r.rentalUnit?.name||r.rentalUnit?.roomNumber||r.tenancy?.tenancyNumber||'—'}</Typography></Grid>
      <Grid size={{xs:5,md:1.5}}><Typography color="text.secondary" sx={{fontSize:9.8}}>{nice(r.type)}</Typography><Typography sx={{fontSize:13,fontWeight:850}}>{money(r.status==='paid'?r.paidAmount:r.amount)}</Typography></Grid>
      <Grid size={{xs:6,md:1.5}}>{status(r)}<Typography color="text.secondary" sx={{fontSize:9.6,mt:.3}}>{nice(r.method)}</Typography></Grid>
      <Grid size={{xs:6,md:2}}><Typography color="text.secondary" sx={{fontSize:9.8}}>Transaction date & time</Typography><Typography sx={{fontSize:10.8,fontWeight:750}}>{dt(r.paidAt||r.paymentVerification?.submittedAt||r.createdAt)}</Typography></Grid>
      <Grid size={{xs:12,md:1.5}}><Stack alignItems={{xs:'flex-start',md:'flex-end'}}><Typography color="text.secondary" sx={{fontSize:9.8}}>Transaction ID</Typography><Typography sx={{fontSize:10.8,fontWeight:800,overflowWrap:'anywhere'}}>{r.transactionId||'—'}</Typography>{r.tenancy?._id&&<Button size="small" onClick={()=>navigate(`/app/tenancy_details/${r.tenancy._id}?tab=rent`)}>Open tenancy</Button>}</Stack></Grid>
    </Grid></Paper>)}</Stack>:<Alert severity="info">No transactions match the selected filters.</Alert>}
    {!loading&&pagination.pages>1&&<Stack direction="row" justifyContent="center" alignItems="center" spacing={1} sx={{mt:2}}><Button variant="outlined" disabled={pagination.page<=1} onClick={()=>void load(pagination.page-1)}>Previous</Button><Typography sx={{fontSize:11.5}}>Page {pagination.page} of {pagination.pages}</Typography><Button variant="outlined" disabled={pagination.page>=pagination.pages} onClick={()=>void load(pagination.page+1)}>Next</Button></Stack>}
  </Box>;
}
