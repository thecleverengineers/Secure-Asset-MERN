import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Grid, MenuItem,
  Stack, TextField, Typography,
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
        ? <Card elevation={0} sx={{border:'1px solid',borderColor:'divider',borderRadius:4}}>
            <CardContent sx={{p:5,textAlign:'center'}}>
              <RequestQuoteRounded color="primary" sx={{fontSize:46}}/>
              <Typography sx={{mt:1,fontSize:17,fontWeight:700}}>No Surveyor quote requests yet</Typography>
              <Typography color="text.secondary" sx={{mt:.5,mb:2,fontSize:12}}>Open the verified Surveyor directory, choose a Surveyor, and send a quote request for one of your properties.</Typography>
              <Button variant="contained" onClick={()=>navigate('/surveyors')}>Browse Surveyors</Button>
            </CardContent>
          </Card>
        : <Grid container spacing={1.5}>{rows.map((item)=>{
            const requestStatus=String(item.requestStatus||'pending');
            const requested=item.requestedSurveyor||{};
            const property=item.property||{};
            return <Grid size={{xs:12,md:6}} key={item._id}>
              <Card elevation={0} sx={{height:'100%',border:'1px solid',borderColor:'divider',borderRadius:4}}>
                <CardContent sx={{p:2.5}}>
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Box sx={{minWidth:0}}>
                      <Typography sx={{fontSize:16,fontWeight:700}} noWrap>{item.title||'Survey quote request'}</Typography>
                      <Typography color="primary" sx={{mt:.35,fontSize:11.5,fontWeight:600}}>{label(item.surveyType)}</Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={label(requestStatus)}
                      color={requestStatus==='accepted'?'success':requestStatus==='rejected'?'error':'warning'}
                    />
                  </Stack>

                  <Stack spacing={.75} sx={{my:1.6}}>
                    <Typography sx={{fontSize:12}}><strong>Surveyor:</strong> {requested.name||item.hiredSurveyor?.name||'Verified Surveyor'}</Typography>
                    <Typography color="text.secondary" sx={{fontSize:11.5}}><strong>Property:</strong> {property.title||property.name||property.code||property.referenceNumber||item.addressApproximate||'Your property'}</Typography>
                    <Typography color="text.secondary" sx={{fontSize:11.5}}><strong>Size:</strong> {item.landArea||'—'} {item.measurementUnit||''}</Typography>
                    <Typography color="text.secondary" sx={{fontSize:11.5}}><strong>Purpose:</strong> {item.purpose||'Property verification'}</Typography>
                    <Typography color="text.secondary" sx={{fontSize:11.5}}><strong>Budget:</strong> {money(item.budget?.min)} – {money(item.budget?.max)}</Typography>
                    <Typography color="text.secondary" sx={{fontSize:11.5}}><strong>Visit:</strong> {item.preferredVisitDate?new Date(item.preferredVisitDate).toLocaleDateString('en-IN'):'Flexible'} · <strong>Report:</strong> {item.preferredCompletionDate?new Date(item.preferredCompletionDate).toLocaleDateString('en-IN'):'Flexible'}</Typography>
                    <Typography color="text.secondary" sx={{fontSize:11.5}}><strong>Requested:</strong> {item.requestedAt?new Date(item.requestedAt).toLocaleString('en-IN'):'—'}</Typography>
                    {item.requestMessage&&<Typography sx={{fontSize:11.5,p:1,bgcolor:'action.hover',borderRadius:1.5}}>{item.requestMessage}</Typography>}
                    {item.respondedAt&&<Typography color="text.secondary" sx={{fontSize:11.5}}><strong>Surveyor responded:</strong> {new Date(item.respondedAt).toLocaleString('en-IN')}</Typography>}
                    {item.responseReason&&<Alert severity={requestStatus==='rejected'?'warning':'info'} sx={{py:.2}}>{item.responseReason}</Alert>}
                  </Stack>

                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {requestStatus==='pending'&&<Chip size="small" variant="outlined" color="warning" label="Waiting for Surveyor review"/>}
                    {requestStatus==='accepted'&&item.project?._id&&<Button size="small" variant="contained" endIcon={<OpenInNewRounded/>} onClick={()=>navigate(`/app/survey-projects/${item.project._id}`)}>Open Project</Button>}
                    {requestStatus==='accepted'&&!item.project?._id&&<Button size="small" variant="contained" onClick={()=>navigate('/app/survey-projects')}>Open Projects</Button>}
                    {requestStatus==='rejected'&&<Button size="small" variant="outlined" onClick={()=>navigate('/surveyors')}>Request Another Surveyor</Button>}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>;
          })}</Grid>}
  </Box>;
}
