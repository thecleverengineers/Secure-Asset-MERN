import { useEffect, useState } from 'react';
import { Alert, Box, Button, Card, Chip, CircularProgress, Container, Grid, InputAdornment, MenuItem, Pagination, Rating, Stack, TextField, Typography } from '@mui/material';
import EngineeringRounded from '@mui/icons-material/EngineeringRounded';
import LocationOnRounded from '@mui/icons-material/LocationOnRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import VerifiedRounded from '@mui/icons-material/VerifiedRounded';
import RequestQuoteRounded from '@mui/icons-material/RequestQuoteRounded';
import { useNavigate } from 'react-router';
import { getPublicSurveyors } from '../services/api';
import '../../styles/surveyor-marketplace-premium.css';

const DIRECTORY_PAGE_SIZE=50;

export default function SurveyorMarketplacePage(){
  const navigate=useNavigate();
  const[rows,setRows]=useState<any[]>([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState('');
  const[page,setPage]=useState(1);
  const[totalPages,setTotalPages]=useState(1);
  const[filters,setFilters]=useState<any>({search:'',location:'',category:'',type:'all',sort:'recommended'});
  async function load(next=page){
    setLoading(true);setError('');
    try{const r=await getPublicSurveyors({...filters,page:next,limit:DIRECTORY_PAGE_SIZE});setRows(Array.isArray(r.data)?r.data:[]);setPage(next);setTotalPages(r.totalPages||1)}
    catch(e){setRows([]);setError((e as Error).message)}
    finally{setLoading(false)}
  }
  useEffect(()=>{void load(1)},[]);
  return <Box className="sa-surveyor-directory" data-secureasset-surveyor-directory="premium-live-api-v210"><Container maxWidth="xl"><Box className="sa-surveyor-directory-inner">
    <Box className="sa-surveyor-directory-heading"><Chip icon={<EngineeringRounded/>} label="Verified professional directory" variant="outlined"/><Typography component="h1">Find a trusted surveyor</Typography><Typography>Discover verified survey professionals and agencies, compare expertise and service areas, then review the right fit for your property.</Typography></Box>
    {error&&<Alert severity="error" className="sa-surveyor-directory-alert">{error}</Alert>}
    <Stack className="sa-surveyor-filter-panel" direction={{xs:'column',md:'row'}} spacing={1}>
      <TextField className="sa-surveyor-filter-field" fullWidth size="small" placeholder="Search surveyors or agencies" value={filters.search} onChange={(e)=>setFilters({...filters,search:e.target.value})} onKeyDown={(e)=>{if(e.key==='Enter')void load(1)}} InputProps={{startAdornment:<InputAdornment position="start"><SearchRounded/></InputAdornment>}}/>
      <TextField className="sa-surveyor-filter-field" size="small" label="Location" value={filters.location} onChange={(e)=>setFilters({...filters,location:e.target.value})}/>
      <TextField className="sa-surveyor-filter-field" size="small" label="Service category" value={filters.category} onChange={(e)=>setFilters({...filters,category:e.target.value})}/>
      <TextField className="sa-surveyor-filter-field" select size="small" label="Profile" value={filters.type} onChange={(e)=>setFilters({...filters,type:e.target.value})} sx={{minWidth:145}}><MenuItem value="all">All profiles</MenuItem><MenuItem value="individual">Individual</MenuItem><MenuItem value="agency">Agency</MenuItem></TextField>
      <TextField className="sa-surveyor-filter-field" select size="small" label="Sort" value={filters.sort} onChange={(e)=>setFilters({...filters,sort:e.target.value})} sx={{minWidth:160}}>{[['recommended','Recommended'],['highest_rated','Highest rated'],['most_experienced','Most experienced'],['lowest_price','Lowest price'],['most_completed','Most completed'],['recently_joined','Recently joined']].map(([v,l])=><MenuItem key={v} value={v}>{l}</MenuItem>)}</TextField>
      <Button className="sa-surveyor-filter-submit" variant="contained" onClick={()=>void load(1)}>Search</Button>
    </Stack>
    <Box className="sa-surveyor-results-title"><Typography>Verified professionals</Typography><Typography>{loading?'Loading directory…':`${rows.length} profile${rows.length===1?'':'s'} on this page`}</Typography></Box>
    {loading?<Box className="sa-surveyor-directory-loading"><CircularProgress size={30}/></Box>:<Grid container spacing={{xs:1,sm:1.4,md:1.8}}>{rows.map(p=>{
      const profilePath=`/surveyors/${p.publicSlug||p._id}`;
      const location=(p.serviceLocations||[]).map((x:any)=>[x.city,x.state].filter(Boolean).join(', ')).filter(Boolean).slice(0,1).join('')||'Service area available';
      const avatarImage=p.profilePhoto||p.agencyLogo||'';
      const coverImage=p.agencyLogo||p.profilePhoto||'';
      return <Grid size={{xs:6,sm:6,lg:3}} key={p._id}>
        <Card elevation={0} className="sa-surveyor-profile-card">
          <Box className="sa-surveyor-card-cover" onClick={()=>navigate(profilePath)}>
            {coverImage
              ? <Box component="img" src={coverImage} alt="" className="sa-surveyor-card-cover-image"/>
              : <Box className="sa-surveyor-card-cover-fallback"/>}
          </Box>
          <Box className="sa-surveyor-card-avatar-wrap" onClick={()=>navigate(profilePath)}>
            {avatarImage
              ? <Box component="img" src={avatarImage} alt={p.name||'Surveyor'} className="sa-surveyor-card-avatar"/>
              : <Box className="sa-surveyor-card-avatar sa-surveyor-card-avatar-fallback">{String(p.name||'S').slice(0,1).toUpperCase()}</Box>}
          </Box>
          <Box className="sa-surveyor-card-body">
            <Stack direction="row" alignItems="center" justifyContent="center" spacing={.45} className="sa-surveyor-card-name-row">
              <Typography className="sa-surveyor-profile-name" noWrap>{p.name}</Typography>
              {p.verificationStatus==='verified'&&<VerifiedRounded className="sa-surveyor-profile-verified"/>}
            </Stack>
            <Stack direction="row" alignItems="center" justifyContent="space-between" className="sa-surveyor-card-meta">
              <Stack direction="row" spacing={.35} alignItems="center" className="sa-surveyor-profile-location">
                <LocationOnRounded/>
                <Typography noWrap>{location}</Typography>
              </Stack>
              <Stack direction="row" alignItems="center" spacing={.3} className="sa-surveyor-profile-rating">
                <Rating readOnly size="small" precision={.1} value={p.rating?.average||0}/>
                <Typography>{Number(p.rating?.average||0).toFixed(1)}</Typography>
              </Stack>
            </Stack>
          </Box>
          <Stack direction="row" className="sa-surveyor-card-actions">
            <Button className="sa-surveyor-profile-button" variant="text" fullWidth onClick={()=>navigate(profilePath)}>Profile</Button>
            <Button className="sa-surveyor-quote-button" variant="contained" fullWidth startIcon={<RequestQuoteRounded/>} onClick={()=>navigate(`${profilePath}?quote=1`)}>Quote</Button>
          </Stack>
        </Card>
      </Grid>;
    })}</Grid>}
    {!loading&&!rows.length&&<Alert severity="info" className="sa-surveyor-directory-alert">No public verified surveyors match the selected filters.</Alert>}
    {totalPages>1&&<Stack alignItems="center" className="sa-surveyor-pagination"><Pagination count={totalPages} page={page} onChange={(_e,p)=>void load(p)} color="primary" shape="rounded"/></Stack>}
  </Box></Container></Box>
}