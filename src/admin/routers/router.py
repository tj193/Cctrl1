from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from ..DataBase import get_session
from ..models import Route, RouteDemand, RouteStatus, RouteDemandStatus

router = APIRouter(prefix="/routes", tags=["Route Management"])

@router.get("/", response_model=List[Route])

def get_routes(status: Optional[RouteStatus] = None , session: Session = Depends(get_session)):

    query = select(Route)
    if status:
        query = query.where(Route.status == status)
    
    routes = session.exec(query).all()
    return routes

@router.patch("/{route_id}/status", response_model=Route)

def update_route_status(route_id: int , new_status: RouteStatus , session: Session = Depends(get_session)):

    route = session.get(Route, route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    route.status = new_status
    session.add(route)
    session.commit()
    session.refresh(route)
    return route

@router.get("/demands", response_model=List[RouteDemand])

def get_route_demands(status: Optional[RouteDemandStatus] = None , session: Session = Depends(get_session)):

    query = select(RouteDemand)
    if status:
        query = query.where(RouteDemand.status == status)
    
    demands = session.exec(query).all()
    return demands