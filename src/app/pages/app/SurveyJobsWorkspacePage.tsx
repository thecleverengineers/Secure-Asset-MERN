import { useEffect, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Divider, Grid, MenuItem,
  Paper, Stack, TextField, Typography,
} from '@mui/material';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import RequestQuoteRounded from '@mui/icons-material/RequestQuoteRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import { useNavigate } from 'react-router';
import CompactPageToolbar from '../../components/layout/CompactPageToolbar';
import { getMySurveyorQuoteRequests } from '../../services/api';

const money=(value:unknown)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(value||0));
const label=(value:unknown)=>String(value||'').replaceAll('_',' ').replace(/\b\w/g,(letter)=>letter.toUpperCase());

export default function SurveyJobsWorkspacePage(){
  const navigate=useNavigate();
  const [rows,setRows]=useState<any[]>([]);
  const [status,setStatus]=useState('');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  async function load(){
    setLoading(true);
    setError('');
    try{
      const response=await getMySurveyorQuoteRequests({limit:100,status:status||undefined});
      setRows(response.data||[]);
    }catch(cause){
      setError((cause as Error).message);
    }finally{
      setLoading(false);
    }
  }

  useEffect(()=>{void load();},[status]);

  return <Box sx={{px:{xs:2,sm:3,lg:4},pb:7}}>
    <CompactPageToolbar
      marker="landlord-survey-quotes-v155"
      title="My Survey Quotes"
      description="Track only the quote requests you sent directly to verified Surveyors."
      actions={<Stack direction="row" spacing={1}>
        <TextField select size="small" label="Status" value={status} onChange={(event)=>setStatus(event.target.value)} sx={{minWidth:150}}>
          <MenuItem value="">All</MenuItem>
          {['pending','accepted','rejected'].map((item)=><MenuItem key={item} value={item}>{label(item)}</MenuItem>)}
        </TextField>
        <Button variant="outlined" startIcon={<RefreshRounded/>} onClick={()=>void load()}>Refresh</Button>
        <Button variant="contained" startIcon={<RequestQuoteRounded/>} onClick={()=>navigate('/surveyors')}>Request Quote</Button>
      </Stack>}
    />

    {error&&<Alert severity="error" onClose={()=>setError('')} sx={{mb:2}}>{error}</Alert>}

    {loading
      ? <Box sx={{minHeight:320,display:'grid',placeItems:'center'}}><CircularProgress/></Box>
      : !rows.length
        ? <Paper elevation={0} sx={{border:'1px solid #dfe8f1',borderRadius:3,p:5,textAlign:'center'}}>
            <RequestQuoteRounded sx={{fontSize:46,color:'#0b6f82'}}/>
            <Typography sx={{mt:1,fontSize:17,fontWeight:600,color:'#17395c'}}>No Surveyor quote requests yet</Typography>
            <Typography color="text.secondary" sx={{mt:.5,mb:2,fontSize:12}}>Open the verified Surveyor directory, choose a Surveyor, and send a quote request for one of your properties.</Typography>
            <Button variant="contained" onClick={()=>navigate('/surveyors')} sx={{textTransform:'none'}}>Browse Surveyors</Button>
          </Paper>
        : <Paper elevation={0} sx={{border:'1px solid #dfe8f1',borderRadius:3,overflow:'hidden',bgcolor:'#fff'}}>
            <Box sx={{display:{xs:'none',md:'block'},px:2.1,py:1.15,bgcolor:'#f6f9fc',borderBottom:'1px solid #e4ebf2'}}>
              <Grid container alignItems="center" columnSpacing={1.5}>
                <Grid size={{md:2.4}}><Typography sx={{fontSize:9.5,fontWeight:600,color:'#70849a',textTransform:'uppercase',letterSpacing:'.04em'}}>Surveyor / Quote</Typography></Grid>
                <Grid size={{md:2.4}}><Typography sx={{fontSize:9.5,fontWeight:600,color:'#70849a',textTransform:'uppercase',letterSpacing:'.04em'}}>Property</Typography></Grid>
                <Grid size={{md:2.1}}><Typography sx={{fontSize:9.5,fontWeight:600,color:'#70849a',textTransform:'uppercase',letterSpacing:'.04em'}}>Survey Details</Typography></Grid>
                <Grid size={{md:1.7}}><Typography sx={{fontSize:9.5,fontWeight:600,color:'#70849a',textTransform:'uppercase',letterSpacing:'.04em'}}>Budget</Typography></Grid>
                <Grid size={{md:1.4}}><Typography sx={{fontSize:9.5,fontWeight:600,color:'#70849a',textTransform:'uppercase',letterSpacing:'.04em'}}>Status</Typography></Grid>
                <Grid size={{md:2}}><Typography sx={{fontSize:9.5,fontWeight:600,color:'#70849a',textTransform:'uppercase',letterSpacing:'.04em',textAlign:'right'}}>Action</Typography></Grid>
              </Grid>
            </Box>

            <Stack divider={<Divider flexItem/>}>
              {rows.map((item)=>{
                const requestStatus=String(item.requestStatus||'pending');
                const requested=item.requestedSurveyor||{};
                const property=item.property||{};
                const surveyorName=requested.name||item.hiredSurveyor?.name||'Verified Surveyor';
                const quoteId=`QT-${String(item._id||'').slice(-7).toUpperCase()}`;
                const propertyName=property.title||property.name||property.code||property.referenceNumber||item.addressApproximate||'Your property';
                const requestedAt=item.requestedAt?new Date(item.requestedAt).toLocaleDateString('en-IN'):'—';
                const visitDate=item.preferredVisitDate?new Date(item.preferredVisitDate).toLocaleDateString('en-IN'):'Flexible';
                return <Box
                  key={item._id}
                  sx={{
                    px:{xs:1.5,md:2.1},
                    py:{xs:1.7,md:1.45},
                    transition:'background-color .15s ease',
                    '&:hover':{bgcolor:'#f9fbfd'},
                  }}
                >
                  <Grid container alignItems={{xs:'flex-start',md:'center'}} rowSpacing={1.35} columnSpacing={1.5}>
                    <Grid size={{xs:12,md:2.4}}>
                      <Stack direction="row" spacing={1.1} alignItems="center">
                        <Avatar src={requested.avatar||item.hiredSurveyor?.avatar||''} sx={{width:38,height:38,bgcolor:'#0b6f82',fontSize:14,fontWeight:600}}>
                          {String(surveyorName).slice(0,1).toUpperCase()}
                        </Avatar>
                        <Box sx={{minWidth:0}}>
                          <Typography noWrap sx={{fontSize:12,fontWeight:600,color:'#17395c'}}>{surveyorName}</Typography>
                          <Typography sx={{mt:.15,fontSize:9.2,color:'#8a99aa'}}>{quoteId}</Typography>
                        </Box>
                      </Stack>
                    </Grid>

                    <Grid size={{xs:12,sm:6,md:2.4}}>
                      <Typography sx={{display:{md:'none'},fontSize:8.5,color:'#91a0ae',textTransform:'uppercase',mb:.25}}>Property</Typography>
                      <Typography noWrap sx={{fontSize:11.2,fontWeight:500,color:'#34516d'}}>{propertyName}</Typography>
                      <Typography noWrap sx={{mt:.25,fontSize:9.2,color:'#8495a8'}}>{item.landArea||'—'} {label(item.measurementUnit||'')}</Typography>
                    </Grid>

                    <Grid size={{xs:12,sm:6,md:2.1}}>
                      <Typography sx={{display:{md:'none'},fontSize:8.5,color:'#91a0ae',textTransform:'uppercase',mb:.25}}>Survey Details</Typography>
                      <Typography noWrap sx={{fontSize:10.8,fontWeight:500,color:'#34516d'}}>{label(item.surveyType||'Property Survey')}</Typography>
                      <Typography noWrap sx={{mt:.25,fontSize:9.2,color:'#8495a8'}}>Visit: {visitDate} · Requested: {requestedAt}</Typography>
                    </Grid>

                    <Grid size={{xs:6,md:1.7}}>
                      <Typography sx={{display:{md:'none'},fontSize:8.5,color:'#91a0ae',textTransform:'uppercase',mb:.25}}>Budget</Typography>
                      <Typography sx={{fontSize:10.8,fontWeight:600,color:'#254b68'}}>{money(item.budget?.min)}</Typography>
                      <Typography sx={{fontSize:8.8,color:'#8495a8'}}>to {money(item.budget?.max)}</Typography>
                    </Grid>

                    <Grid size={{xs:6,md:1.4}}>
                      <Typography sx={{display:{md:'none'},fontSize:8.5,color:'#91a0ae',textTransform:'uppercase',mb:.25}}>Status</Typography>
                      <Chip
                        size="small"
                        label={label(requestStatus)}
                        color={requestStatus==='accepted'?'success':requestStatus==='rejected'?'error':'warning'}
                        sx={{height:23,fontSize:8.5,fontWeight:600}}
                      />
                    </Grid>

                    <Grid size={{xs:12,md:2}}>
                      <Stack direction="row" justifyContent={{xs:'flex-start',md:'flex-end'}} spacing={.7} flexWrap="wrap" useFlexGap>
                        {requestStatus==='pending'&&<Chip size="small" variant="outlined" color="warning" label="Awaiting review" sx={{height:26,fontSize:8.3}}/>}
                        {requestStatus==='accepted'&&item.project?._id&&<Button size="small" variant="contained" endIcon={<OpenInNewRounded/>} onClick={()=>navigate(`/app/survey-projects/${item.project._id}`)} sx={{textTransform:'none',fontSize:9,minHeight:28}}>Open Project</Button>}
                        {requestStatus==='accepted'&&!item.project?._id&&<Button size="small" variant="contained" onClick={()=>navigate('/app/survey-projects')} sx={{textTransform:'none',fontSize:9,minHeight:28}}>Open Projects</Button>}
                        {requestStatus==='rejected'&&<Button size="small" variant="outlined" onClick={()=>navigate('/surveyors')} sx={{textTransform:'none',fontSize:9,minHeight:28}}>Request Again</Button>}
                      </Stack>
                    </Grid>
                  </Grid>

                  {(item.requestMessage||item.responseReason||item.respondedAt)&&<Box sx={{ml:{md:'49px'},mt:1.05,p:1.05,borderRadius:1.5,bgcolor:'#f8fafc'}}>
                    {item.requestMessage&&<Typography sx={{fontSize:9.6,color:'#667d92'}}><strong>Request:</strong> {item.requestMessage}</Typography>}
                    {item.responseReason&&<Typography sx={{mt:item.requestMessage ? .5 : 0,fontSize:9.6,color:requestStatus==='rejected'?'#a14949':'#667d92'}}><strong>Surveyor response:</strong> {item.responseReason}</Typography>}
                    {item.respondedAt&&<Typography sx={{mt:.35,fontSize:8.7,color:'#98a5b2'}}>Responded {new Date(item.respondedAt).toLocaleString('en-IN')}</Typography>}
                  </Box>}
                </Box>;
              })}
            </Stack>
          </Paper>}
  </Box>;
}
