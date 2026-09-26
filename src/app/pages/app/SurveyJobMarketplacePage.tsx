import { useEffect, useState, type FormEvent } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, DialogActions,
  DialogContent, Grid, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import CancelRounded from '@mui/icons-material/CancelRounded';
import LocationOnRounded from '@mui/icons-material/LocationOnRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import StraightenRounded from '@mui/icons-material/StraightenRounded';
import { useNavigate } from 'react-router';
import ProfessionalDialog from '../../components/shared/ProfessionalDialog';
import CompactPageToolbar from '../../components/layout/CompactPageToolbar';
import { getIncomingSurveyorQuoteRequests, respondSurveyorQuoteRequest } from '../../services/api';

const money=(value:unknown)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(value||0));
const label=(value:unknown)=>String(value||'').replaceAll('_',' ').replace(/\b\w/g,(letter)=>letter.toUpperCase());

export default function SurveyJobMarketplacePage(){
  const navigate=useNavigate();
  const [rows,setRows]=useState<any[]>([]);
  const [status,setStatus]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [review,setReview]=useState<any>(null);
  const [responseReason,setResponseReason]=useState('');

  async function load(){
    setLoading(true);
    setError('');
    try{
      const response=await getIncomingSurveyorQuoteRequests({limit:100,status:status||undefined});
      setRows(response.data||[]);
    }catch(cause){
      setError((cause as Error).message);
    }finally{
      setLoading(false);
    }
  }

  useEffect(()=>{void load();},[status]);

  async function respond(event:FormEvent){
    event.preventDefault();
    if(!review)return;
    setBusy(true);
    setError('');
    try{
      const decision=review.decision as 'accept'|'reject';
      const response=await respondSurveyorQuoteRequest(review._id,{decision,reason:responseReason.trim()||undefined});
      const projectId=response.data?.project?._id;
      setReview(null);
      setResponseReason('');
      setNotice(response.message||(decision==='accept'?'Quote request accepted.':'Quote request rejected.'));
      await load();
      if(decision==='accept'&&projectId)navigate(`/app/survey-projects/${projectId}`);
    }catch(cause){
      setError((cause as Error).message);
    }finally{
      setBusy(false);
    }
  }

  return <Box sx={{px:{xs:2,sm:3,lg:4},pb:7}}>
    <CompactPageToolbar
      marker="surveyor-direct-quote-requests-v155"
      title="Quote Requests"
      description="Review only the direct quote requests landlords sent specifically to your Surveyor account."
      actions={<Stack direction="row" spacing={1}>
        <TextField select size="small" label="Status" value={status} onChange={(event)=>setStatus(event.target.value)} sx={{minWidth:150}}>
          <MenuItem value="">All</MenuItem>
          {['pending','accepted','rejected'].map((item)=><MenuItem key={item} value={item}>{label(item)}</MenuItem>)}
        </TextField>
        <Button variant="outlined" startIcon={<RefreshRounded/>} onClick={()=>void load()}>Refresh</Button>
      </Stack>}
    />

    {notice&&<Alert severity="success" onClose={()=>setNotice('')} sx={{mb:2}}>{notice}</Alert>}
    {error&&<Alert severity="error" onClose={()=>setError('')} sx={{mb:2}}>{error}</Alert>}

    {loading
      ? <Box sx={{minHeight:320,display:'grid',placeItems:'center'}}><CircularProgress/></Box>
      : !rows.length
        ? <Alert severity="info">No landlords have requested a direct quote from you yet.</Alert>
        : <Grid container spacing={1.5}>{rows.map((item)=>{
            const requestStatus=String(item.requestStatus||'pending');
            return <Grid size={{xs:12,md:6}} key={item._id}>
              <Card elevation={0} sx={{height:'100%',border:'1px solid',borderColor:requestStatus==='pending'?'warning.light':'divider',borderRadius:4,bgcolor:requestStatus==='pending'?'rgba(255,248,230,.34)':'background.paper'}}>
                <CardContent sx={{p:2.5}}>
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Box sx={{minWidth:0}}>
                      <Typography sx={{fontSize:16,fontWeight:700}}>{item.title||'Survey quote request'}</Typography>
                      <Typography color="primary" sx={{mt:.35,fontSize:11.5,fontWeight:600}}>{label(item.surveyType)}</Typography>
                    </Box>
                    <Chip size="small" label={label(requestStatus)} color={requestStatus==='accepted'?'success':requestStatus==='rejected'?'error':'warning'}/>
                  </Stack>

                  <Typography color="text.secondary" sx={{mt:1.2,fontSize:11.5}}>Requested by {item.client?.name||'Landlord'} · {item.requestedAt?new Date(item.requestedAt).toLocaleString('en-IN'):'Recently'}</Typography>

                  <Stack spacing={.8} sx={{my:1.5}}>
                    <Stack direction="row" spacing={.8}><LocationOnRounded sx={{fontSize:17,color:'text.secondary'}}/><Typography sx={{fontSize:11.5}}>{item.addressApproximate||'Approximate location protected'}</Typography></Stack>
                    <Stack direction="row" spacing={.8}><StraightenRounded sx={{fontSize:17,color:'text.secondary'}}/><Typography sx={{fontSize:11.5}}>{item.landArea||'—'} {item.measurementUnit||''} · {item.propertyType||'Property'}</Typography></Stack>
                    <Typography sx={{fontSize:11.5}}><strong>Purpose:</strong> {item.purpose||'Property verification'}</Typography>
                    <Typography sx={{fontSize:11.5}}><strong>Budget:</strong> {money(item.budget?.min)} – {money(item.budget?.max)}</Typography>
                    <Typography sx={{fontSize:11.5}}><strong>Visit:</strong> {item.preferredVisitDate?new Date(item.preferredVisitDate).toLocaleDateString('en-IN'):'Flexible'} · <strong>Report:</strong> {item.preferredCompletionDate?new Date(item.preferredCompletionDate).toLocaleDateString('en-IN'):'Flexible'}</Typography>
                    {item.requestMessage&&<Typography color="text.secondary" sx={{fontSize:11.5,p:1,bgcolor:'action.hover',borderRadius:1.5}}>{item.requestMessage}</Typography>}
                    {item.responseReason&&<Alert severity={requestStatus==='rejected'?'warning':'info'} sx={{py:.2}}>{item.responseReason}</Alert>}
                  </Stack>

                  {requestStatus==='pending'
                    ? <Stack direction="row" spacing={.8}>
                        <Button color="success" variant="contained" size="small" startIcon={<CheckCircleRounded/>} onClick={()=>setReview({...item,decision:'accept'})}>Review & Accept</Button>
                        <Button color="error" variant="outlined" size="small" startIcon={<CancelRounded/>} onClick={()=>setReview({...item,decision:'reject'})}>Reject</Button>
                      </Stack>
                    : requestStatus==='accepted'&&item.project?._id
                      ? <Button size="small" variant="contained" onClick={()=>navigate(`/app/survey-projects/${item.project._id}`)}>Open Accepted Project</Button>
                      : <Chip size="small" variant="outlined" label={requestStatus==='rejected'?'Request closed':label(requestStatus)}/>}
                </CardContent>
              </Card>
            </Grid>;
          })}</Grid>}

    <ProfessionalDialog
      open={Boolean(review)}
      onClose={()=>!busy&&setReview(null)}
      maxWidth="sm"
      fullWidth
      professionalTitle={review?.decision==='accept'?'Review & accept quote request':'Reject quote request'}
      professionalSubtitle={review?.decision==='accept'?'Accepting creates the secure Survey Project for you and the landlord.':'The landlord will see the rejection and your optional reason.'}
    >
      <Box component="form" onSubmit={respond}>
        <DialogContent dividers>
          <Stack spacing={1.1}>
            <Typography sx={{fontWeight:700}}>{review?.title||'Direct survey request'}</Typography>
            <Typography variant="body2"><strong>Landlord:</strong> {review?.client?.name||'Landlord'}</Typography>
            <Typography variant="body2"><strong>Location:</strong> {review?.addressApproximate||'Protected'}</Typography>
            <Typography variant="body2"><strong>Size:</strong> {review?.landArea||'—'} {review?.measurementUnit||''}</Typography>
            <Typography variant="body2"><strong>Purpose:</strong> {review?.purpose||'Property verification'}</Typography>
            <Typography variant="body2"><strong>Budget:</strong> {money(review?.budget?.min)} – {money(review?.budget?.max)}</Typography>
            {review?.requestMessage&&<Alert severity="info">{review.requestMessage}</Alert>}
            <TextField
              fullWidth
              multiline
              minRows={3}
              label={review?.decision==='accept'?'Note for landlord (optional)':'Reason for rejection (optional)'}
              value={responseReason}
              onChange={(event)=>setResponseReason(event.target.value)}
              inputProps={{maxLength:1200}}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setReview(null)} disabled={busy}>Cancel</Button>
          <Button type="submit" color={review?.decision==='accept'?'success':'error'} variant="contained" disabled={busy}>
            {busy?'Saving…':review?.decision==='accept'?'Accept & Create Project':'Reject Request'}
          </Button>
        </DialogActions>
      </Box>
    </ProfessionalDialog>
  </Box>;
}
